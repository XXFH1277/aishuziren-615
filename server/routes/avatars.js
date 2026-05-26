import express from 'express';
import { db, fromJson, nextId, now, toJson } from '../db/database.js';
import { fail, page, success } from '../utils/response.js';

const router = express.Router();

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

  if (!payload.name || !String(payload.name).trim()) {
    return fail(res, '数字人名称不能为空', 40001, { field: 'name', reason: '名称不能为空' });
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
