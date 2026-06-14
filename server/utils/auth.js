import crypto from 'node:crypto';
import { db, fromJson, now } from '../db/database.js';
import { FORBIDDEN, UNAUTHORIZED } from './errorCodes.js';
import { getPermissionKeysForRole } from './permissions.js';
import { fail } from './response.js';

export const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export function getSessionExpiresAt(ttlMs = SESSION_TTL_MS) {
  return new Date(Date.now() + ttlMs).toISOString();
}

export function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashSessionToken(token);
  const timestamp = now();
  const sessionExpiresAt = getSessionExpiresAt();

  db.prepare(
    `INSERT INTO auth_sessions (
      id, user_id, token_hash, expires_at, revoked_at, created_at, updated_at
    ) VALUES (
      @id, @userId, @tokenHash, @expiresAt, '', @createdAt, @updatedAt
    )`,
  ).run({
    id: `SESS_${crypto.randomUUID()}`,
    userId,
    tokenHash,
    expiresAt: sessionExpiresAt,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return {
    token,
    tokenType: 'Bearer',
    sessionExpiresAt,
  };
}

export function getBearerToken(req) {
  const authorization = req.headers.authorization || '';

  if (!authorization.startsWith('Bearer ')) {
    return '';
  }

  return authorization.slice('Bearer '.length).trim();
}

export function revokeSession(token) {
  if (!token) {
    return false;
  }

  const tokenHash = hashSessionToken(token);
  const result = db
    .prepare(
      `UPDATE auth_sessions
       SET revoked_at = @revokedAt, updated_at = @updatedAt
       WHERE token_hash = @tokenHash AND (revoked_at IS NULL OR revoked_at = '')`,
    )
    .run({
      tokenHash,
      revokedAt: now(),
      updatedAt: now(),
    });

  return result.changes > 0;
}

export function refreshSession(token) {
  const tokenHash = hashSessionToken(token);
  const sessionExpiresAt = getSessionExpiresAt();
  const result = db
    .prepare(
      `UPDATE auth_sessions
       SET expires_at = @expiresAt, updated_at = @updatedAt
       WHERE token_hash = @tokenHash AND (revoked_at IS NULL OR revoked_at = '')`,
    )
    .run({
      tokenHash,
      expiresAt: sessionExpiresAt,
      updatedAt: now(),
    });

  return result.changes > 0 ? sessionExpiresAt : '';
}

function sanitizeUser(row) {
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    lastLoginAt: row.last_login_at,
    mustChangePassword: Boolean(Number(row.must_change_password || 0)),
  };
}

function sanitizeRole(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    permissionScope: row.permission_scope,
    dataScope: row.data_scope,
    menuPermissions: fromJson(row.menu_permissions, []),
    status: row.status,
  };
}

export function buildAuthPayload(userRow, sessionRow = null) {
  const roleRow = db.prepare('SELECT * FROM roles WHERE name = ? LIMIT 1').get(userRow.role);
  const role = sanitizeRole(roleRow);
  const permissionKeys = fromJson(roleRow?.permission_keys, null) || getPermissionKeysForRole(userRow.role);

  return {
    user: sanitizeUser(userRow),
    roles: role ? [role] : [],
    permissions: permissionKeys,
    menuPermissions: role?.menuPermissions || [],
    sessionExpiresAt: sessionRow?.expires_at || null,
  };
}

export function resolveSession(req) {
  const token = getBearerToken(req);

  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const session = db
    .prepare(
      `SELECT *
       FROM auth_sessions
       WHERE token_hash = @tokenHash
         AND (revoked_at IS NULL OR revoked_at = '')
       LIMIT 1`,
    )
    .get({ tokenHash });

  if (!session || !session.expires_at || new Date(session.expires_at).getTime() <= Date.now()) {
    return null;
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ? LIMIT 1').get(session.user_id);

  if (!user || user.status !== '启用') {
    return null;
  }

  return {
    token,
    session,
    user,
    auth: buildAuthPayload(user, session),
  };
}

export function requireAuth(req, res, next) {
  const resolved = resolveSession(req);

  if (!resolved) {
    return fail(res, '请先登录', UNAUTHORIZED);
  }

  req.auth = resolved.auth;
  req.authToken = resolved.token;
  req.authSession = resolved.session;
  req.authUser = resolved.user;

  return next();
}

export function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.auth) {
      return requireAuth(req, res, () => requirePermission(permissionKey)(req, res, next));
    }

    if (!req.auth.permissions.includes(permissionKey)) {
      return fail(res, '当前角色没有该操作权限', FORBIDDEN, {
        permission: permissionKey,
      });
    }

    return next();
  };
}
