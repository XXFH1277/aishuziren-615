import express from 'express';
import { db, fromJson, nextId, now } from '../db/database.js';
import { page, success } from '../utils/response.js';

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

function toBoolean(value) {
  return Boolean(Number(value || 0));
}

function mapBackground(row) {
  return {
    id: row.id,
    name: row.name,
    style: row.style,
    ratio: row.ratio,
    category: row.category,
    prompt: row.prompt,
    status: row.status,
    previewColor: row.preview_color,
    suitableScene: row.suitable_scene,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLayout(row) {
  return {
    id: row.id,
    name: row.name,
    ratio: row.ratio,
    avatarPosition: row.avatar_position,
    productAreaPosition: row.product_area_position,
    danmuPosition: row.danmu_position,
    hasCouponArea: toBoolean(row.has_coupon_area),
    hasTitleBar: toBoolean(row.has_title_bar),
    suitableForObs: toBoolean(row.suitable_for_obs),
    status: row.status,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOutputStatus(row) {
  return {
    id: row.id,
    obsStatus: row.obs_status,
    virtualCameraStatus: row.virtual_camera_status,
    windowCaptureStatus: row.window_capture_status,
    obsVersion: row.obs_version,
    currentScene: row.current_scene,
    currentSource: row.current_source,
    resolution: row.resolution,
    fps: Number(row.fps || 0),
    lastHeartbeatAt: row.last_heartbeat_at,
    sceneMappings: fromJson(row.scene_mappings_json, []),
    checklist: fromJson(row.checklist_json, []),
    updatedAt: row.updated_at,
  };
}

router.get('/studio/backgrounds', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = {
    limit: pageSize,
    offset,
  };
  const clauses = [];

  if (req.query.category) {
    params.category = req.query.category;
    clauses.push('category = @category');
  }

  if (req.query.style) {
    params.style = req.query.style;
    clauses.push('style = @style');
  }

  if (req.query.ratio) {
    params.ratio = req.query.ratio;
    clauses.push('ratio = @ratio');
  }

  if (req.query.status) {
    params.status = req.query.status;
    clauses.push('status = @status');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM studio_backgrounds ${whereSql}`).get(params).count;
  const rows = db
    .prepare(`SELECT * FROM studio_backgrounds ${whereSql} ORDER BY created_at DESC, id DESC LIMIT @limit OFFSET @offset`)
    .all(params);

  return page(res, rows.map(mapBackground), total, pageNumber, pageSize);
});

router.post('/studio/backgrounds/generate-mock', (req, res) => {
  const body = req.body || {};
  const timestamp = now();
  const id = nextId('studio_backgrounds', 'SB');
  const background = {
    id,
    name: body.name || `${body.category || 'Mock'} 背景方案 ${id}`,
    style: body.style || body.visualStyle || 'Mock 风格',
    ratio: body.ratio || '9:16 竖屏',
    category: body.category || '其他',
    prompt: body.prompt || 'Mock background prompt, no real image generation request.',
    status: body.status || '已生成',
    previewColor: body.previewColor || body.mainColor || '#2563eb',
    suitableScene: body.suitableScene || body.roomType || 'Mock 直播间',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  db.prepare(
    `INSERT INTO studio_backgrounds (
      id, name, style, ratio, category, prompt, status, preview_color,
      suitable_scene, created_at, updated_at
    ) VALUES (
      @id, @name, @style, @ratio, @category, @prompt, @status, @previewColor,
      @suitableScene, @createdAt, @updatedAt
    )`,
  ).run(background);

  const row = db.prepare('SELECT * FROM studio_backgrounds WHERE id = ?').get(id);
  return success(res, {
    background: mapBackground(row),
    mock: true,
    message: 'Mock background generated locally. No external image API was called.',
  });
});

router.get('/studio/layouts', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = {
    limit: pageSize,
    offset,
  };
  const clauses = [];

  if (req.query.ratio) {
    params.ratio = req.query.ratio;
    clauses.push('ratio = @ratio');
  }

  if (req.query.status) {
    params.status = req.query.status;
    clauses.push('status = @status');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM studio_layouts ${whereSql}`).get(params).count;
  const rows = db
    .prepare(`SELECT * FROM studio_layouts ${whereSql} ORDER BY id ASC LIMIT @limit OFFSET @offset`)
    .all(params);

  return page(res, rows.map(mapLayout), total, pageNumber, pageSize);
});

router.get('/studio/output-status', (req, res) => {
  const row = db.prepare('SELECT * FROM studio_output_status ORDER BY id ASC LIMIT 1').get();
  return success(res, {
    outputStatus: row ? mapOutputStatus(row) : null,
  });
});

export default router;
