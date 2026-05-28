import crypto from 'node:crypto';

const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
  keylen: 64,
};

function normalizePassword(password = '') {
  return String(password);
}

function parsePasswordHash(storedHash = '') {
  const [algorithm, paramsText, salt, hash] = storedHash.split('$');

  if (algorithm !== 'scrypt' || !paramsText || !salt || !hash) {
    return null;
  }

  const params = Object.fromEntries(
    paramsText.split(',').map((item) => {
      const [key, value] = item.split('=');
      return [key, Number(value)];
    }),
  );

  if (!params.N || !params.r || !params.p || !params.keylen) {
    return null;
  }

  return {
    params,
    salt,
    hash,
  };
}

export function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const normalizedPassword = normalizePassword(password);
  const hash = crypto
    .scryptSync(normalizedPassword, salt, SCRYPT_OPTIONS.keylen, {
      N: SCRYPT_OPTIONS.N,
      r: SCRYPT_OPTIONS.r,
      p: SCRYPT_OPTIONS.p,
    })
    .toString('hex');

  return `scrypt$N=${SCRYPT_OPTIONS.N},r=${SCRYPT_OPTIONS.r},p=${SCRYPT_OPTIONS.p},keylen=${SCRYPT_OPTIONS.keylen}$${salt}$${hash}`;
}

export function verifyPassword(password, storedHash) {
  const parsed = parsePasswordHash(storedHash);

  if (!parsed) {
    return false;
  }

  const expected = Buffer.from(parsed.hash, 'hex');
  const actual = crypto.scryptSync(normalizePassword(password), parsed.salt, parsed.params.keylen, {
    N: parsed.params.N,
    r: parsed.params.r,
    p: parsed.params.p,
  });

  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
