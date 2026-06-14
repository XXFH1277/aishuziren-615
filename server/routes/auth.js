import express from 'express';
import { db, now } from '../db/database.js';
import { createSession, buildAuthPayload, getBearerToken, refreshSession, requireAuth, resolveSession, revokeSession } from '../utils/auth.js';
import { LOGIN_LOCKED, PARAM_ERROR, UNAUTHORIZED } from '../utils/errorCodes.js';
import {
  clearLoginFailures,
  getLoginClientIp,
  getLoginLock,
  recordLoginFailure,
} from '../utils/loginSecurity.js';
import { recordOperationLog } from '../utils/operationLog.js';
import { createPasswordHash, verifyPassword } from '../utils/password.js';
import { fail, success } from '../utils/response.js';
import { assertRequired, toValidationErrorPayload } from '../utils/validators.js';

const router = express.Router();

function findLoginUser(username) {
  return db.prepare('SELECT * FROM users WHERE username = ? LIMIT 1').get(username);
}

function validateNewPassword(password) {
  const value = String(password || '');
  const checks = [
    value.length >= 12,
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ];

  if (!checks.every(Boolean)) {
    const error = new Error('新密码强度不足');
    error.code = PARAM_ERROR;
    error.field = 'newPassword';
    error.reason = '新密码至少 12 位，并包含大小写字母、数字和符号';
    throw error;
  }
}

function recordAuthLog({ username, action, result, description }) {
  recordOperationLog(db, {
    username,
    module: '登录鉴权',
    action,
    targetName: username,
    result,
    description,
  });
}

router.post('/login', (req, res) => {
  const payload = req.body || {};

  try {
    assertRequired(payload.username, 'username', '用户名不能为空');
    assertRequired(payload.password, 'password', '密码不能为空');
  } catch (error) {
    return fail(res, '参数错误', error.code || PARAM_ERROR, toValidationErrorPayload(error));
  }

  const username = String(payload.username).trim();
  const clientIp = getLoginClientIp(req);
  const existingLock = getLoginLock(username, clientIp);

  if (existingLock) {
    recordAuthLog({
      username,
      action: '登录锁定',
      result: '失败',
      description: `登录失败次数过多，账号已临时锁定到 ${existingLock.lockedUntil}。`,
    });
    return fail(res, '登录失败次数过多，请稍后再试', LOGIN_LOCKED, {
      lockedUntil: existingLock.lockedUntil,
    });
  }

  const user = findLoginUser(username);

  if (!user || !verifyPassword(payload.password, user.password_hash)) {
    const attempt = recordLoginFailure(username, clientIp);
    recordAuthLog({
      username,
      action: '登录失败',
      result: '失败',
      description: attempt.locked
        ? `账号或密码错误，失败次数已达到限制，锁定到 ${attempt.lockedUntil}。`
        : `账号或密码错误，当前失败次数 ${attempt.failureCount}。`,
    });
    return fail(
      res,
      attempt.locked ? '登录失败次数过多，请稍后再试' : '账号或密码错误',
      attempt.locked ? LOGIN_LOCKED : UNAUTHORIZED,
      attempt.locked ? { lockedUntil: attempt.lockedUntil } : null,
    );
  }

  if (user.status !== '启用') {
    recordAuthLog({
      username,
      action: '登录失败',
      result: '失败',
      description: `账号状态为${user.status || '未知'}，禁止登录。`,
    });
    return fail(res, '账号不可用，请联系管理员', UNAUTHORIZED, {
      status: user.status,
    });
  }

  const role = db.prepare('SELECT * FROM roles WHERE name = ? LIMIT 1').get(user.role);

  if (!role || role.status !== '启用') {
    recordAuthLog({
      username,
      action: '登录失败',
      result: '失败',
      description: `角色状态不可用：${user.role || '未配置角色'}。`,
    });
    return fail(res, '角色不可用，请联系管理员', UNAUTHORIZED, {
      role: user.role,
    });
  }

  clearLoginFailures(username, clientIp);

  const session = createSession(user.id);
  const timestamp = now();

  db.prepare(
    `UPDATE users
     SET last_login_at = @lastLoginAt,
         recent_login = 1,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: user.id,
    lastLoginAt: timestamp,
    updatedAt: timestamp,
  });

  const refreshedUser = db.prepare('SELECT * FROM users WHERE id = ? LIMIT 1').get(user.id);

  recordAuthLog({
    username,
    action: '登录成功',
    result: '成功',
    description: '本地账号通过密码校验并创建会话 token。',
  });

  return success(res, {
    ...buildAuthPayload(refreshedUser, { expires_at: session.sessionExpiresAt }),
    token: session.token,
    tokenType: session.tokenType,
    mock: false,
  });
});

router.post('/logout', (req, res) => {
  const token = getBearerToken(req);
  const resolved = resolveSession(req);
  revokeSession(token);

  if (resolved?.auth?.user?.username) {
    recordAuthLog({
      username: resolved.auth.user.username,
      action: '退出登录',
      result: '成功',
      description: '用户主动退出登录，会话 token 已作废。',
    });
  }

  return success(res, {
    success: true,
    mock: false,
    loggedOutAt: now(),
  });
});

router.get('/me', requireAuth, (req, res) => {
  return success(res, req.auth);
});

router.post('/refresh', requireAuth, (req, res) => {
  const sessionExpiresAt = refreshSession(req.authToken);

  return success(res, {
    ...req.auth,
    success: true,
    mock: false,
    sessionExpiresAt,
  });
});

router.post('/change-password', requireAuth, (req, res) => {
  const payload = req.body || {};

  try {
    assertRequired(payload.oldPassword, 'oldPassword', '旧密码不能为空');
    assertRequired(payload.newPassword, 'newPassword', '新密码不能为空');
    validateNewPassword(payload.newPassword);
  } catch (error) {
    return fail(res, '参数错误', error.code || PARAM_ERROR, toValidationErrorPayload(error));
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ? LIMIT 1').get(req.authUser.id);

  if (!user || !verifyPassword(payload.oldPassword, user.password_hash)) {
    recordAuthLog({
      username: req.authUser.username,
      action: '修改密码失败',
      result: '失败',
      description: '旧密码校验失败。',
    });
    return fail(res, '旧密码不正确', UNAUTHORIZED);
  }

  db.prepare(
    `UPDATE users
     SET password_hash = @passwordHash,
         must_change_password = 0,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: user.id,
    passwordHash: createPasswordHash(payload.newPassword),
    updatedAt: now(),
  });

  recordAuthLog({
    username: req.authUser.username,
    action: '修改密码',
    result: '成功',
    description: '用户已完成本地账号密码修改，未记录明文密码。',
  });

  const refreshedUser = db.prepare('SELECT * FROM users WHERE id = ? LIMIT 1').get(user.id);

  return success(res, {
    success: true,
    user: buildAuthPayload(refreshedUser, req.authSession).user,
    changedAt: now(),
  });
});

export default router;
