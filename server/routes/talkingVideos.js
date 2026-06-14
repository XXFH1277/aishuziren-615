import express from 'express';
import { db, fromJson, nextId, now, toJson } from '../db/database.js';
import {
  buildComplianceErrorDetail,
  buildComplianceRiskTips,
  checkComplianceText,
  isComplianceBlockingResult,
} from '../utils/compliance.js';
import { NOT_FOUND, PARAM_ERROR } from '../utils/errorCodes.js';
import { fail, page, success } from '../utils/response.js';

const router = express.Router();
const allowedStatuses = new Set(['created', 'recording', 'completed', 'failed', 'cancelled']);

function getPagination(req) {
  const pageNumber = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
  const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize || '20', 10), 1), 100);
  return {
    pageNumber,
    pageSize,
    offset: (pageNumber - 1) * pageSize,
  };
}

function trimText(value = '') {
  return String(value || '').trim();
}

function getAvatarRuntime(avatar) {
  return fromJson(avatar?.image_settings, {})?.liveRuntime || {};
}

function mapJob(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    scriptText: row.script_text,
    avatarId: row.avatar_id,
    avatarName: row.avatar_name,
    liveTalkingAvatarId: row.livetalking_avatar_id,
    provider: row.provider,
    voiceEngine: row.voice_engine,
    cloneMode: row.clone_mode,
    ratio: row.ratio,
    resolution: row.resolution,
    status: row.status,
    progress: Number(row.progress || 0),
    durationSeconds: Number(row.duration_seconds || 0),
    outputFileId: row.output_file_id,
    outputFileName: row.output_file_name,
    outputVideoUrl: row.output_video_url,
    outputLocalPath: row.output_local_path,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size || 0),
    errorMessage: row.error_message,
    engineSnapshot: fromJson(row.engine_snapshot_json, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

function getJobOrFail(res, id) {
  const row = db.prepare('SELECT * FROM talking_video_jobs WHERE id = ?').get(id);

  if (!row) {
    fail(res, '口播视频任务不存在', NOT_FOUND, { id });
    return null;
  }

  return row;
}

function getAvatarConfig(avatarId) {
  if (!avatarId) {
    return {
      avatarName: '',
      liveTalkingAvatarId: '',
      runtime: {},
    };
  }

  const avatar = db.prepare('SELECT * FROM avatars WHERE id = ?').get(avatarId);
  if (!avatar) {
    return null;
  }

  const runtime = getAvatarRuntime(avatar);
  return {
    avatarName: avatar.name,
    liveTalkingAvatarId: runtime.livetalkingAvatarId || runtime.avatarId || runtime.preprocessedAvatarId || '',
    runtime,
  };
}

router.get('/talking-videos/jobs', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = {
    limit: pageSize,
    offset,
  };
  const clauses = [];

  if (req.query.status) {
    params.status = req.query.status;
    clauses.push('status = @status');
  }

  if (req.query.avatarId) {
    params.avatarId = req.query.avatarId;
    clauses.push('avatar_id = @avatarId');
  }

  if (req.query.keyword) {
    params.keyword = `%${req.query.keyword}%`;
    clauses.push('(title LIKE @keyword OR script_text LIKE @keyword OR avatar_name LIKE @keyword)');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM talking_video_jobs ${whereSql}`).get(params).count;
  const rows = db
    .prepare(
      `SELECT *
       FROM talking_video_jobs
       ${whereSql}
       ORDER BY created_at DESC, id DESC
       LIMIT @limit OFFSET @offset`,
    )
    .all(params);

  return page(res, rows.map(mapJob), total, pageNumber, pageSize);
});

router.get('/talking-videos/jobs/:id', (req, res) => {
  const row = getJobOrFail(res, req.params.id);
  if (!row) return null;
  return success(res, { job: mapJob(row) });
});

router.post('/talking-videos/jobs', (req, res) => {
  const body = req.body || {};
  const title = trimText(body.title) || `口播视频 ${new Date().toLocaleString('zh-CN', { hour12: false })}`;
  const scriptText = trimText(body.scriptText || body.script || body.text);

  if (!scriptText) {
    return fail(res, '口播文案不能为空', PARAM_ERROR, { field: 'scriptText', reason: '请输入要播报的文案' });
  }

  const compliance = checkComplianceText(scriptText);
  if (isComplianceBlockingResult(compliance)) {
    return fail(res, '命中高风险合规规则，已拦截', PARAM_ERROR, buildComplianceErrorDetail(compliance));
  }

  const avatarConfig = getAvatarConfig(body.avatarId || '');
  if (avatarConfig === null) {
    return fail(res, '选择的数字人不存在', NOT_FOUND, { field: 'avatarId', id: body.avatarId });
  }

  const timestamp = now();
  const id = nextId('talking_video_jobs', 'TV');
  const liveTalkingAvatarId = trimText(body.liveTalkingAvatarId) || avatarConfig.liveTalkingAvatarId;
  const engineSnapshot = {
    avatarRuntime: avatarConfig.runtime,
    riskTips: buildComplianceRiskTips(compliance),
    recordBufferSeconds: Number(body.recordBufferSeconds || 3),
    createdBy: req.authUser?.username || req.authUser?.id || 'local-user',
  };

  db.prepare(
    `INSERT INTO talking_video_jobs (
      id, title, script_text, avatar_id, avatar_name, livetalking_avatar_id,
      provider, voice_engine, clone_mode, ratio, resolution, status, progress,
      duration_seconds, output_file_id, output_file_name, output_video_url,
      output_local_path, mime_type, file_size, error_message, engine_snapshot_json,
      created_at, updated_at, started_at, finished_at
    ) VALUES (
      @id, @title, @scriptText, @avatarId, @avatarName, @liveTalkingAvatarId,
      @provider, @voiceEngine, @cloneMode, @ratio, @resolution, @status, @progress,
      0, '', '', '', '', '', 0, '', @engineSnapshot,
      @createdAt, @updatedAt, '', ''
    )`,
  ).run({
    id,
    title,
    scriptText,
    avatarId: body.avatarId || '',
    avatarName: body.avatarName || avatarConfig.avatarName || '',
    liveTalkingAvatarId,
    provider: body.provider || 'livetalking',
    voiceEngine: body.voiceEngine || 'voxcpm2',
    cloneMode: body.cloneMode || 'hifi',
    ratio: body.ratio || '9:16',
    resolution: body.resolution || '720p',
    status: 'created',
    progress: 5,
    engineSnapshot: toJson(engineSnapshot),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return success(
    res,
    {
      job: mapJob(db.prepare('SELECT * FROM talking_video_jobs WHERE id = ?').get(id)),
      riskTips: buildComplianceRiskTips(compliance),
    },
    'created',
  );
});

router.patch('/talking-videos/jobs/:id/status', (req, res) => {
  const row = getJobOrFail(res, req.params.id);
  if (!row) return null;

  const status = trimText(req.body?.status);
  if (!allowedStatuses.has(status)) {
    return fail(res, '任务状态不支持', PARAM_ERROR, { field: 'status', reason: `仅支持 ${[...allowedStatuses].join(', ')}` });
  }

  const timestamp = now();
  const nextProgress = Number.isFinite(Number(req.body?.progress))
    ? Math.max(0, Math.min(100, Number(req.body.progress)))
    : status === 'completed'
      ? 100
      : status === 'failed'
        ? Number(row.progress || 0)
        : Number(row.progress || 0);

  db.prepare(
    `UPDATE talking_video_jobs
     SET status = @status,
         progress = @progress,
         error_message = @errorMessage,
         started_at = CASE WHEN @status = 'recording' AND (started_at IS NULL OR started_at = '') THEN @timestamp ELSE started_at END,
         finished_at = CASE WHEN @status IN ('completed', 'failed', 'cancelled') THEN @timestamp ELSE finished_at END,
         updated_at = @timestamp
     WHERE id = @id`,
  ).run({
    id: req.params.id,
    status,
    progress: nextProgress,
    errorMessage: req.body?.errorMessage || '',
    timestamp,
  });

  return success(res, { job: mapJob(db.prepare('SELECT * FROM talking_video_jobs WHERE id = ?').get(req.params.id)) });
});

router.post('/talking-videos/jobs/:id/result', (req, res) => {
  const row = getJobOrFail(res, req.params.id);
  if (!row) return null;

  const body = req.body || {};
  if (!body.outputVideoUrl && !body.outputFileId) {
    return fail(res, '输出视频文件不能为空', PARAM_ERROR, {
      field: 'outputVideoUrl',
      reason: '请先上传录制完成的视频文件',
    });
  }

  const timestamp = now();
  db.prepare(
    `UPDATE talking_video_jobs
     SET status = 'completed',
         progress = 100,
         duration_seconds = @durationSeconds,
         output_file_id = @outputFileId,
         output_file_name = @outputFileName,
         output_video_url = @outputVideoUrl,
         output_local_path = @outputLocalPath,
         mime_type = @mimeType,
         file_size = @fileSize,
         error_message = '',
         finished_at = @finishedAt,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: req.params.id,
    durationSeconds: Number(body.durationSeconds || 0),
    outputFileId: body.outputFileId || '',
    outputFileName: body.outputFileName || '',
    outputVideoUrl: body.outputVideoUrl || '',
    outputLocalPath: body.outputLocalPath || '',
    mimeType: body.mimeType || '',
    fileSize: Number(body.fileSize || 0),
    finishedAt: timestamp,
    updatedAt: timestamp,
  });

  return success(res, { job: mapJob(db.prepare('SELECT * FROM talking_video_jobs WHERE id = ?').get(req.params.id)) });
});

export default router;
