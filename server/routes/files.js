import express from 'express';
import { db, nextId, now } from '../db/database.js';
import { PARAM_ERROR } from '../utils/errorCodes.js';
import { fail, success } from '../utils/response.js';

const router = express.Router();

router.post('/upload', (req, res) => {
  const payload = req.body || {};
  const fileName = String(payload.fileName || '').trim();

  if (!fileName) {
    return fail(res, '参数错误', PARAM_ERROR, {
      field: 'fileName',
      reason: '文件名不能为空。当前阶段仅支持 JSON Mock 上传占位。',
    });
  }

  const timestamp = now();
  const fileId = nextId('file_assets', 'FILE');
  const fileType = payload.fileType || 'document';
  const moduleName = payload.module || 'common';
  const fileUrl = `/mock-files/${encodeURIComponent(fileName)}`;

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
    fileName,
    fileUrl,
    fileType,
    module: moduleName,
    businessId: payload.businessId || '',
    size: Number(payload.size || 0),
    mimeType: payload.mimeType || 'application/octet-stream',
    uploadedBy: payload.uploadedBy || 'mock-user',
    createdAt: timestamp,
  });

  return success(res, {
    file: {
      fileId,
      id: fileId,
      fileName,
      fileUrl,
      fileType,
      module: moduleName,
      businessId: payload.businessId || '',
      size: Number(payload.size || 0),
      uploadedAt: timestamp,
    },
    mock: true,
    message: 'Mock 上传成功。当前阶段不保存真实文件、不上传云端、不解析 multipart。',
  });
});

export default router;
