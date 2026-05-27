import express from 'express';
import { db, fromJson, now } from '../db/database.js';
import { success } from '../utils/response.js';

const router = express.Router();

function resolveMockUser(username = 'admin') {
  const row =
    db.prepare('SELECT * FROM users WHERE username = ? LIMIT 1').get(username) ||
    db.prepare('SELECT * FROM users ORDER BY id ASC LIMIT 1').get();

  if (!row) {
    return {
      id: 'U001',
      username: 'admin',
      nickname: '系统管理员',
      role: '超级管理员',
      permissions: [],
    };
  }

  const role = db.prepare('SELECT * FROM roles WHERE name = ? LIMIT 1').get(row.role);

  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    email: row.email,
    phone: row.phone,
    role: row.role,
    permissions: fromJson(role?.operation_permissions, []),
  };
}

function mockSessionPayload(user) {
  return {
    user,
    mock: true,
    sessionExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  };
}

router.post('/login', (req, res) => {
  const user = resolveMockUser(req.body?.username || 'admin');
  return success(res, {
    ...mockSessionPayload(user),
    message: 'Mock 登录成功。当前阶段不校验密码、不生成真实 token、不设置真实 Cookie。',
  });
});

router.post('/logout', (req, res) => {
  return success(res, {
    success: true,
    mock: true,
    loggedOutAt: now(),
  });
});

router.get('/me', (req, res) => {
  return success(res, mockSessionPayload(resolveMockUser()));
});

router.post('/refresh', (req, res) => {
  return success(res, {
    success: true,
    mock: true,
    sessionExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  });
});

export default router;
