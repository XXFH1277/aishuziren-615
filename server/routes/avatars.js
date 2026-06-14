import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { db, fromJson, nextId, now, toJson } from '../db/database.js';
import {
  createLiveTalkingAvatarTask,
  getLiveTalkingAvatarPath,
  getLiveTalkingAvatarTask,
} from '../integrations/tencentDigitalHuman.js';
import { SERVER_ERROR } from '../utils/errorCodes.js';
import { fail, page, success } from '../utils/response.js';
import { uploadPublicPrefix, uploadRoot } from '../utils/uploadConfig.js';
import { assertRequired, toValidationErrorPayload } from '../utils/validators.js';

const router = express.Router();
const avatarSourceVideoModule = 'avatar_sources';
const avatarSourceVideoExtensions = new Set(['.mp4', '.mov', '.webm', '.mkv', '.avi']);

function getPagination(req) {
  const pageNumber = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
  const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize || '20', 10), 1), 100);
  return {
    pageNumber,
    pageSize,
    offset: (pageNumber - 1) * pageSize,
  };
}

function mapAvatar(row) {
  return {
    id: row.id,
    name: row.name,
    avatarImage: row.avatar_image,
    persona: row.persona,
    suitableCategories: fromJson(row.suitable_categories, []),
    voiceName: row.voice_name,
    status: row.status,
    boundLiveRooms: Number(row.bound_live_rooms || 0),
    languageStyle: row.language_style,
    behaviorRules: fromJson(row.behavior_rules, []),
    voiceSettings: fromJson(row.voice_settings, {}),
    imageSettings: fromJson(row.image_settings, {}),
    trainingAssets: fromJson(row.training_assets, {}),
    authorizationStatus: fromJson(row.authorization_status, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAvatarAction(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    triggerScene: row.trigger_scene,
    suitableTone: row.suitable_tone,
    status: row.status,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeAvatarBody(body, existing = {}) {
  return {
    name: body.name ?? existing.name,
    avatarImage: body.avatarImage ?? body.avatar_image ?? existing.avatar_image ?? '',
    persona: body.persona ?? existing.persona ?? '',
    suitableCategories: body.suitableCategories ?? existing.suitable_categories ?? [],
    voiceName: body.voiceName ?? body.voice_name ?? existing.voice_name ?? '',
    status: body.status ?? existing.status ?? '草稿',
    boundLiveRooms: Number(body.boundLiveRooms ?? existing.bound_live_rooms ?? 0),
    languageStyle: body.languageStyle ?? body.language_style ?? existing.language_style ?? '',
    behaviorRules: body.behaviorRules ?? existing.behavior_rules ?? [],
    voiceSettings: body.voiceSettings ?? existing.voice_settings ?? {},
    imageSettings: body.imageSettings ?? existing.image_settings ?? {},
    trainingAssets: body.trainingAssets ?? existing.training_assets ?? {},
    authorizationStatus: body.authorizationStatus ?? existing.authorization_status ?? {},
  };
}

function normalizeRuntimeAvatarId(value) {
  return String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getAvatarRuntimeFromRow(row) {
  const imageSettings = fromJson(row?.image_settings, {});
  return imageSettings.liveRuntime || {};
}

function buildRuntimeAvatarId(row, body = {}) {
  const runtime = getAvatarRuntimeFromRow(row);
  const requested = normalizeRuntimeAvatarId(
    body.livetalkingAvatarId ||
      body.avatarId ||
      body.preprocessedAvatarId ||
      runtime.livetalkingAvatarId ||
      runtime.avatarId ||
      '',
  );

  if (requested) {
    return requested;
  }

  const model = normalizeRuntimeAvatarId(body.modelRoute || runtime.modelRoute || 'wav2lip') || 'wav2lip';
  return `local_${normalizeRuntimeAvatarId(row.id).toLowerCase()}_${model}_${Date.now()}`;
}

function updateAvatarRuntime(row, runtimePatch = {}) {
  const timestamp = now();
  const imageSettings = fromJson(row.image_settings, {});
  const trainingAssets = fromJson(row.training_assets, {});
  const currentRuntime = imageSettings.liveRuntime || {};
  const nextRuntime = {
    ...currentRuntime,
    ...runtimePatch,
    provider: 'livetalking',
    updatedAt: timestamp,
  };

  db.prepare(
    `UPDATE avatars
     SET image_settings = @imageSettings,
         training_assets = @trainingAssets,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: row.id,
    imageSettings: toJson({
      ...imageSettings,
      liveRuntime: nextRuntime,
    }),
    trainingAssets: toJson({
      ...trainingAssets,
      sourceVideoPath: nextRuntime.sourceVideoPath || trainingAssets.sourceVideoPath || '',
    }),
    updatedAt: timestamp,
  });

  return db.prepare('SELECT * FROM avatars WHERE id = ?').get(row.id);
}

function getAvatarSourceVideoDir() {
  const sourceDir = path.join(uploadRoot, avatarSourceVideoModule);
  fs.mkdirSync(sourceDir, { recursive: true });
  return sourceDir;
}

function mapAvatarSourceVideo(sourceDir, dirent) {
  const filePath = path.join(sourceDir, dirent.name);
  const stats = fs.statSync(filePath);

  return {
    fileName: dirent.name,
    filePath,
    fileUrl: `${uploadPublicPrefix}/${encodeURIComponent(avatarSourceVideoModule)}/${encodeURIComponent(dirent.name)}`,
    extension: path.extname(dirent.name).toLowerCase(),
    size: stats.size,
    updatedAt: stats.mtime.toISOString(),
    status: stats.size > 0 ? 'ready' : 'empty',
  };
}

router.get('/avatars/source-videos', (req, res) => {
  try {
    const sourceDir = getAvatarSourceVideoDir();
    const files = fs
      .readdirSync(sourceDir, { withFileTypes: true })
      .filter((dirent) => dirent.isFile() && avatarSourceVideoExtensions.has(path.extname(dirent.name).toLowerCase()))
      .map((dirent) => mapAvatarSourceVideo(sourceDir, dirent))
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

    return success(res, {
      module: avatarSourceVideoModule,
      folderPath: sourceDir,
      files,
    });
  } catch (error) {
    return fail(res, error.message || '源视频素材箱扫描失败', SERVER_ERROR);
  }
});

router.get('/avatars', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = {
    limit: pageSize,
    offset,
  };
  const clauses = [];

  if (req.query.keyword) {
    params.keyword = `%${req.query.keyword}%`;
    clauses.push('(name LIKE @keyword OR persona LIKE @keyword OR voice_name LIKE @keyword)');
  }

  if (req.query.status) {
    params.status = req.query.status;
    clauses.push('status = @status');
  }

  if (req.query.category) {
    params.category = `%${req.query.category}%`;
    clauses.push('suitable_categories LIKE @category');
  }

  if (req.query.voiceName) {
    params.voiceName = req.query.voiceName;
    clauses.push('voice_name = @voiceName');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM avatars ${whereSql}`).get(params).count;
  const rows = db
    .prepare(`SELECT * FROM avatars ${whereSql} ORDER BY updated_at DESC LIMIT @limit OFFSET @offset`)
    .all(params);

  return page(res, rows.map(mapAvatar), total, pageNumber, pageSize);
});

router.get('/avatars/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM avatars WHERE id = ?').get(req.params.id);

  if (!row) {
    return fail(res, '数字人不存在', 40400, { id: req.params.id });
  }

  return success(res, { avatar: mapAvatar(row) });
});

router.post('/avatars', (req, res) => {
  const payload = normalizeAvatarBody(req.body || {});

  try {
    assertRequired(payload.name, 'name', '数字人名称不能为空');
  } catch (error) {
    return fail(res, '参数错误', error.code, toValidationErrorPayload(error));
  }

  const timestamp = now();
  const id = req.body?.id || nextId('avatars', 'A');

  db.prepare(
    `INSERT INTO avatars (
      id, name, avatar_image, persona, suitable_categories, voice_name, status,
      bound_live_rooms, language_style, behavior_rules, voice_settings, image_settings,
      training_assets, authorization_status, created_at, updated_at
    ) VALUES (
      @id, @name, @avatarImage, @persona, @suitableCategories, @voiceName, @status,
      @boundLiveRooms, @languageStyle, @behaviorRules, @voiceSettings, @imageSettings,
      @trainingAssets, @authorizationStatus, @createdAt, @updatedAt
    )`,
  ).run({
    ...payload,
    id,
    suitableCategories: toJson(payload.suitableCategories),
    behaviorRules: toJson(payload.behaviorRules),
    voiceSettings: toJson(payload.voiceSettings),
    imageSettings: toJson(payload.imageSettings),
    trainingAssets: toJson(payload.trainingAssets),
    authorizationStatus: toJson(payload.authorizationStatus),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const avatar = db.prepare('SELECT * FROM avatars WHERE id = ?').get(id);
  return success(res, { avatar: mapAvatar(avatar) }, 'created');
});

router.put('/avatars/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM avatars WHERE id = ?').get(req.params.id);

  if (!existing) {
    return fail(res, '数字人不存在', 40400, { id: req.params.id });
  }

  const payload = normalizeAvatarBody(req.body || {}, existing);

  if (!payload.name || !String(payload.name).trim()) {
    return fail(res, '数字人名称不能为空', 40001, { field: 'name', reason: '名称不能为空' });
  }

  db.prepare(
    `UPDATE avatars SET
      name = @name,
      avatar_image = @avatarImage,
      persona = @persona,
      suitable_categories = @suitableCategories,
      voice_name = @voiceName,
      status = @status,
      bound_live_rooms = @boundLiveRooms,
      language_style = @languageStyle,
      behavior_rules = @behaviorRules,
      voice_settings = @voiceSettings,
      image_settings = @imageSettings,
      training_assets = @trainingAssets,
      authorization_status = @authorizationStatus,
      updated_at = @updatedAt
    WHERE id = @id`,
  ).run({
    ...payload,
    id: req.params.id,
    suitableCategories: toJson(payload.suitableCategories),
    behaviorRules: toJson(payload.behaviorRules),
    voiceSettings: toJson(payload.voiceSettings),
    imageSettings: toJson(payload.imageSettings),
    trainingAssets: toJson(payload.trainingAssets),
    authorizationStatus: toJson(payload.authorizationStatus),
    updatedAt: now(),
  });

  const avatar = db.prepare('SELECT * FROM avatars WHERE id = ?').get(req.params.id);
  return success(res, { avatar: mapAvatar(avatar) });
});

router.delete('/avatars/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM avatars WHERE id = ?').get(req.params.id);

  if (!existing) {
    return fail(res, '数字人不存在', 40400, { id: req.params.id });
  }

  const timestamp = now();
  const clearLiveRooms = db
    .prepare(
      `UPDATE live_rooms
       SET avatar_id = '',
           avatar_name = '',
           updated_at = @updatedAt
       WHERE avatar_id = @id`,
    )
    .run({ id: req.params.id, updatedAt: timestamp });
  const clearLiveTasks = db
    .prepare(
      `UPDATE live_tasks
       SET avatar_id = '',
           avatar_name = '',
           updated_at = @updatedAt
       WHERE avatar_id = @id
         AND status IN ('待启动', '已暂停', '直播中')`,
    )
    .run({ id: req.params.id, updatedAt: timestamp });

  db.prepare('DELETE FROM avatars WHERE id = ?').run(req.params.id);

  return success(res, {
    deletedId: req.params.id,
    clearedLiveRooms: clearLiveRooms.changes || 0,
    clearedLiveTasks: clearLiveTasks.changes || 0,
  });
});

router.post('/avatars/:id/live-runtime/preprocess', async (req, res) => {
  const existing = db.prepare('SELECT * FROM avatars WHERE id = ?').get(req.params.id);

  if (!existing) {
    return fail(res, '数字人不存在', 40400, { id: req.params.id });
  }

  const body = req.body || {};
  const runtime = getAvatarRuntimeFromRow(existing);
  const trainingAssets = fromJson(existing.training_assets, {});
  const sourceVideoPath = String(body.sourceVideoPath || runtime.sourceVideoPath || trainingAssets.sourceVideoPath || '').trim();

  if (!sourceVideoPath) {
    return fail(res, '请先填写本机源视频路径', 40001, {
      field: 'sourceVideoPath',
      reason: 'LiveTalking avatar 预处理需要可访问的视频路径',
    });
  }

  const modelRoute = String(body.modelRoute || runtime.modelRoute || 'wav2lip').trim().toLowerCase();
  if (!['wav2lip', 'musetalk'].includes(modelRoute)) {
    return fail(res, '暂只支持 wav2lip 或 musetalk 预处理路线', 40001, {
      field: 'modelRoute',
      reason: modelRoute,
    });
  }

  const livetalkingAvatarId = buildRuntimeAvatarId(existing, body);
  const taskId = normalizeRuntimeAvatarId(body.taskId || `odh_${existing.id}_${Date.now()}`);
  const taskPayload = {
    model: modelRoute,
    avatar_id: livetalkingAvatarId,
    video_path: sourceVideoPath,
    task_id: taskId,
    img_size: Number(body.imgSize || runtime.imgSize || 256),
    face_det_batch_size: Number(body.faceDetBatchSize || runtime.faceDetBatchSize || 8),
    pads: body.pads || runtime.pads || '0 20 0 0',
    bbox_shift: Number(body.bboxShift || runtime.bboxShift || 0),
    extra_margin: Number(body.extraMargin || runtime.extraMargin || 10),
    parsing_mode: body.parsingMode || runtime.parsingMode || 'jaw',
    version: body.version || runtime.version || 'v15',
  };

  let task;
  try {
    task = await createLiveTalkingAvatarTask(taskPayload);
  } catch (error) {
    return fail(res, error.message || 'LiveTalking 预处理任务创建失败', SERVER_ERROR);
  }

  const updated = updateAvatarRuntime(existing, {
    livetalkingAvatarId,
    sourceVideoPath,
    preprocessedPath: getLiveTalkingAvatarPath(livetalkingAvatarId),
    modelRoute,
    resolution: body.resolution || runtime.resolution || '720p',
    status: 'preprocessing',
    preprocessTaskId: task.task_id || taskId,
    preprocessProgress: 0,
    preprocessError: '',
    preprocessStartedAt: now(),
    taskPayload,
    note: body.note || runtime.note || '',
  });

  return success(res, {
    avatar: mapAvatar(updated),
    task: {
      taskId: task.task_id || taskId,
      avatarId: livetalkingAvatarId,
      modelRoute,
      status: 'pending',
      progress: 0,
    },
    mock: false,
  }, 'created');
});

router.get('/avatars/:id/live-runtime/preprocess/:taskId', async (req, res) => {
  const existing = db.prepare('SELECT * FROM avatars WHERE id = ?').get(req.params.id);

  if (!existing) {
    return fail(res, '数字人不存在', 40400, { id: req.params.id });
  }

  let task;
  try {
    task = await getLiveTalkingAvatarTask(req.params.taskId);
  } catch (error) {
    return fail(res, error.message || 'LiveTalking 预处理任务查询失败', SERVER_ERROR);
  }

  const runtime = getAvatarRuntimeFromRow(existing);
  const taskStatus = task.status || runtime.status || 'preprocessing';
  const nextStatus = taskStatus === 'completed'
    ? 'ready'
    : taskStatus === 'failed'
      ? 'failed'
      : 'preprocessing';
  const updated = updateAvatarRuntime(existing, {
    ...runtime,
    status: nextStatus,
    preprocessTaskId: task.task_id || req.params.taskId,
    preprocessProgress: Number(task.progress || 0),
    preprocessError: task.error_msg || '',
    preprocessFinishedAt: taskStatus === 'completed' || taskStatus === 'failed' ? now() : runtime.preprocessFinishedAt || '',
    preprocessedPath: getLiveTalkingAvatarPath(task.avatar_id || runtime.livetalkingAvatarId || ''),
  });

  return success(res, {
    avatar: mapAvatar(updated),
    task: {
      taskId: task.task_id || req.params.taskId,
      avatarId: task.avatar_id || runtime.livetalkingAvatarId || '',
      modelRoute: task.model_type || runtime.modelRoute || '',
      status: taskStatus,
      progress: Number(task.progress || 0),
      errorMessage: task.error_msg || '',
      duration: task.duration || 0,
    },
    mock: false,
  });
});

router.get('/avatar-actions', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = {
    limit: pageSize,
    offset,
  };
  const clauses = [];

  if (req.query.type) {
    params.type = req.query.type;
    clauses.push('type = @type');
  }

  if (req.query.status) {
    params.status = req.query.status;
    clauses.push('status = @status');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM avatar_actions ${whereSql}`).get(params).count;
  const rows = db
    .prepare(`SELECT * FROM avatar_actions ${whereSql} ORDER BY id ASC LIMIT @limit OFFSET @offset`)
    .all(params);

  return page(res, rows.map(mapAvatarAction), total, pageNumber, pageSize);
});

export default router;
