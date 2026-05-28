import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { db, nextId, now } from '../db/database.js';
import { requireAuth } from '../utils/auth.js';
import { PARAM_ERROR } from '../utils/errorCodes.js';
import { fail, success } from '../utils/response.js';
import { allowedMimeTypes, allowedUploadDescription, maxUploadSize, uploadPublicPrefix, uploadRoot } from '../utils/uploadConfig.js';

const router = express.Router();

function sanitizeFileName(fileName = 'upload') {
  const parsed = path.parse(String(fileName));
  const baseName = parsed.name
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return baseName || 'upload';
}

function sanitizePathSegment(value = 'common') {
  const segment = String(value || 'common')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

  return segment || 'common';
}

function parseMultipartBody(buffer, boundary) {
  const boundaryText = `--${boundary}`;
  const bodyText = buffer.toString('binary');
  const segments = bodyText.split(boundaryText).slice(1, -1);
  const fields = {};
  let file = null;

  segments.forEach((segment) => {
    let partText = segment;

    if (partText.startsWith('\r\n')) {
      partText = partText.slice(2);
    }

    const headerEndIndex = partText.indexOf('\r\n\r\n');

    if (headerEndIndex === -1) {
      return;
    }

    const rawHeaders = partText.slice(0, headerEndIndex);
    let contentText = partText.slice(headerEndIndex + 4);

    if (contentText.endsWith('\r\n')) {
      contentText = contentText.slice(0, -2);
    }

    const headers = Object.fromEntries(
      rawHeaders.split('\r\n').map((line) => {
        const separatorIndex = line.indexOf(':');
        if (separatorIndex === -1) {
          return [line.toLowerCase(), ''];
        }
        return [line.slice(0, separatorIndex).trim().toLowerCase(), line.slice(separatorIndex + 1).trim()];
      }),
    );

    const disposition = headers['content-disposition'] || '';
    const name = disposition.match(/name="([^"]+)"/)?.[1];
    const originalName = disposition.match(/filename="([^"]*)"/)?.[1];
    const content = Buffer.from(contentText, 'binary');

    if (!name) {
      return;
    }

    if (originalName !== undefined) {
      file = {
        fieldName: name,
        originalName,
        mimeType: headers['content-type'] || 'application/octet-stream',
        buffer: content,
      };
      return;
    }

    fields[name] = content.toString('utf8');
  });

  return { fields, file };
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;

    req.on('data', (chunk) => {
      totalSize += chunk.length;

      if (totalSize > maxUploadSize) {
        reject(
          Object.assign(new Error('文件大小不能超过 5MB'), {
            code: PARAM_ERROR,
            field: 'file',
            reason: '文件大小不能超过 5MB',
          }),
        );
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function getBoundary(contentType = '') {
  return contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2] || '';
}

function mapFileAsset(row) {
  return {
    id: row.id,
    fileId: row.id,
    fileName: row.file_name,
    fileUrl: row.file_url,
    fileType: row.file_type,
    module: row.module,
    businessId: row.business_id,
    size: Number(row.size || 0),
    mimeType: row.mime_type,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.created_at,
  };
}

router.post('/upload', requireAuth, async (req, res) => {
  const contentType = req.headers['content-type'] || '';

  if (!contentType.includes('multipart/form-data')) {
    return fail(res, '参数错误', PARAM_ERROR, {
      field: 'file',
      reason: '请使用 multipart/form-data 上传真实文件',
    });
  }

  const boundary = getBoundary(contentType);

  if (!boundary) {
    return fail(res, '参数错误', PARAM_ERROR, {
      field: 'file',
      reason: 'multipart boundary 不能为空',
    });
  }

  let multipart;

  try {
    const bodyBuffer = await readRequestBody(req);
    multipart = parseMultipartBody(bodyBuffer, boundary);
  } catch (error) {
    return fail(res, '参数错误', error.code || PARAM_ERROR, {
      field: error.field || 'file',
      reason: error.reason || error.message || '文件上传失败',
    });
  }

  if (!multipart.file?.buffer?.length) {
    return fail(res, '参数错误', PARAM_ERROR, {
      field: 'file',
      reason: '请选择要上传的文件',
    });
  }

  const mimeConfig = allowedMimeTypes.get(multipart.file.mimeType);

  if (!mimeConfig) {
    return fail(res, '文件类型不支持', PARAM_ERROR, {
      field: 'file',
      reason: `仅支持 ${allowedUploadDescription}`,
    });
  }

  const timestamp = now();
  const moduleName = sanitizePathSegment(multipart.fields.module || 'common');
  const businessId = multipart.fields.businessId || '';
  const fileId = nextId('file_assets', 'FILE');
  const safeName = sanitizeFileName(multipart.file.originalName);
  const storedFileName = `${fileId}-${crypto.randomBytes(6).toString('hex')}-${safeName}${mimeConfig.extension}`;
  const moduleDir = path.join(uploadRoot, moduleName);

  fs.mkdirSync(moduleDir, { recursive: true });
  fs.writeFileSync(path.join(moduleDir, storedFileName), multipart.file.buffer);

  const fileUrl = `${uploadPublicPrefix}/${encodeURIComponent(moduleName)}/${encodeURIComponent(storedFileName)}`;

  db.prepare(
    `INSERT INTO file_assets (
      id, file_name, file_url, file_type, module, business_id,
      size, mime_type, uploaded_by, created_at
    ) VALUES (
      @id, @fileName, @fileUrl, @fileType, @module, @businessId,
      @size, @mimeType, @uploadedBy, @createdAt
    )`,
  ).run({
    id: fileId,
    fileName: multipart.file.originalName || storedFileName,
    fileUrl,
    fileType: multipart.fields.fileType || mimeConfig.fileType,
    module: moduleName,
    businessId,
    size: multipart.file.buffer.length,
    mimeType: multipart.file.mimeType,
    uploadedBy: req.auth?.user?.username || 'local-user',
    createdAt: timestamp,
  });

  const row = db.prepare('SELECT * FROM file_assets WHERE id = ?').get(fileId);

  return success(res, {
    file: mapFileAsset(row),
    mock: false,
    message: '文件已保存到本地 server/uploads，并记录到 SQLite。',
  });
});

export default router;
