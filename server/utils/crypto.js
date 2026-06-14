import crypto from 'node:crypto';

// 客户/平台模型密钥的“静态加密”工具（AES-256-GCM）。
// 主密钥 KEK 来自后端环境变量 CRED_ENC_KEY，绝不入库、不进前端、不进仓库。
// 明文只在后端调用模型的瞬间解密使用，用完即弃。

const ALGO = 'aes-256-gcm';

function readKek() {
  const raw = String(process.env.CRED_ENC_KEY || '').trim();

  if (!raw) {
    return null;
  }

  // 接受 64 位十六进制（32 字节）
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  // 或 base64 编码的 32 字节
  try {
    const buf = Buffer.from(raw, 'base64');
    if (buf.length === 32) {
      return buf;
    }
  } catch {
    // 落到返回 null
  }

  return null;
}

export function isEncryptionConfigured() {
  return readKek() !== null;
}

export function encryptSecret(plaintext) {
  const key = readKek();

  if (!key) {
    throw new Error('后端未配置 CRED_ENC_KEY（需 32 字节 / 64 位十六进制），无法加密保存真实密钥。');
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    cipher: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function decryptSecret({ cipher, iv, tag } = {}) {
  const key = readKek();

  if (!key) {
    throw new Error('后端未配置 CRED_ENC_KEY，无法解密模型密钥。');
  }

  if (!cipher || !iv || !tag) {
    return '';
  }

  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(cipher, 'base64')), decipher.final()]);

  return decrypted.toString('utf8');
}
