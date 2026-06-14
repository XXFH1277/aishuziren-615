import crypto from 'node:crypto';
import { db } from '../db/database.js';
import { DEVICE_UNAUTHORIZED, FORBIDDEN } from './errorCodes.js';
import { fail } from './response.js';

export function createDeviceToken() {
  return `dev_${crypto.randomBytes(32).toString('base64url')}`;
}

export function hashDeviceToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

export function getDeviceBearerToken(req) {
  const authorization = req.headers.authorization || '';

  if (!authorization.startsWith('Bearer ')) {
    return '';
  }

  return authorization.slice('Bearer '.length).trim();
}

export function resolveDeviceToken(req) {
  const token = getDeviceBearerToken(req);

  if (!token) {
    return null;
  }

  const tokenHash = hashDeviceToken(token);
  const executor = db
    .prepare(
      `SELECT *
       FROM executors
       WHERE device_token_hash = ?
       LIMIT 1`,
    )
    .get(tokenHash);

  if (!executor) {
    return null;
  }

  return {
    token,
    executor,
  };
}

export function requireDeviceAuth(req, res, next) {
  const resolved = resolveDeviceToken(req);

  if (!resolved) {
    return fail(res, '执行端认证失败', DEVICE_UNAUTHORIZED);
  }

  req.deviceToken = resolved.token;
  req.deviceExecutor = resolved.executor;

  return next();
}

export function requireDeviceExecutor(req, res, next) {
  if (!req.deviceExecutor) {
    return requireDeviceAuth(req, res, () => requireDeviceExecutor(req, res, next));
  }

  if (req.deviceExecutor.id !== req.params.id) {
    return fail(res, '执行端无权访问该资源', FORBIDDEN, {
      executorId: req.params.id,
    });
  }

  return next();
}
