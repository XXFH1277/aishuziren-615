import { db, now } from '../db/database.js';

export const LOGIN_FAILURE_WINDOW_MS = 5 * 60 * 1000;
export const LOGIN_LOCK_DURATION_MS = 10 * 60 * 1000;
export const LOGIN_FAILURE_LIMIT = 5;

function toTimestamp(value) {
  const time = new Date(value || '').getTime();
  return Number.isFinite(time) ? time : 0;
}

function futureIso(ms) {
  return new Date(Date.now() + ms).toISOString();
}

export function getLoginClientIp(req) {
  return String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 128);
}

export function normalizeLoginUsername(username) {
  return String(username || '').trim().toLowerCase();
}

export function getLoginAttempt(username, ip) {
  return db
    .prepare('SELECT * FROM auth_login_attempts WHERE username = ? AND ip = ? LIMIT 1')
    .get(normalizeLoginUsername(username), ip);
}

export function getLoginLock(username, ip) {
  const attempt = getLoginAttempt(username, ip);

  if (!attempt?.locked_until) {
    return null;
  }

  if (toTimestamp(attempt.locked_until) <= Date.now()) {
    return null;
  }

  return {
    lockedUntil: attempt.locked_until,
    failureCount: Number(attempt.failure_count || 0),
  };
}

export function recordLoginFailure(username, ip) {
  const normalizedUsername = normalizeLoginUsername(username);
  const existing = getLoginAttempt(normalizedUsername, ip);
  const timestamp = now();
  const firstFailedAt = existing?.first_failed_at || timestamp;
  const inWindow = existing && Date.now() - toTimestamp(firstFailedAt) <= LOGIN_FAILURE_WINDOW_MS;
  const failureCount = inWindow ? Number(existing.failure_count || 0) + 1 : 1;
  const lockedUntil = failureCount >= LOGIN_FAILURE_LIMIT ? futureIso(LOGIN_LOCK_DURATION_MS) : '';
  const nextFirstFailedAt = inWindow ? firstFailedAt : timestamp;

  db.prepare(
    `INSERT INTO auth_login_attempts (
      username, ip, failure_count, first_failed_at, last_failed_at, locked_until, created_at, updated_at
    ) VALUES (
      @username, @ip, @failureCount, @firstFailedAt, @lastFailedAt, @lockedUntil, @createdAt, @updatedAt
    )
    ON CONFLICT(username, ip) DO UPDATE SET
      failure_count = excluded.failure_count,
      first_failed_at = excluded.first_failed_at,
      last_failed_at = excluded.last_failed_at,
      locked_until = excluded.locked_until,
      updated_at = excluded.updated_at`,
  ).run({
    username: normalizedUsername,
    ip,
    failureCount,
    firstFailedAt: nextFirstFailedAt,
    lastFailedAt: timestamp,
    lockedUntil,
    createdAt: existing?.created_at || timestamp,
    updatedAt: timestamp,
  });

  return {
    failureCount,
    lockedUntil,
    locked: Boolean(lockedUntil && toTimestamp(lockedUntil) > Date.now()),
  };
}

export function clearLoginFailures(username, ip) {
  db.prepare('DELETE FROM auth_login_attempts WHERE username = ? AND ip = ?').run(normalizeLoginUsername(username), ip);
}
