import express from 'express';
import { db, fromJson, nextId, now } from '../db/database.js';
import {
  getDigitalHumanAdapter,
  getDigitalHumanMode,
} from '../integrations/tencentDigitalHuman.js';
import { SERVER_ERROR } from '../utils/errorCodes.js';
import { fail, success } from '../utils/response.js';

const router = express.Router();
const CONFIG_ID = 'LOCAL';
const OPEN_STATUSES = new Set(['ready', 'live']);

function trimText(value = '') {
  return String(value || '').trim();
}

function mapSession(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    roomName: row.room_name,
    figureId: row.figure_id,
    mode: row.mode,
    provider: row.provider,
    status: row.status,
    streamUrl: row.stream_url,
    lastText: row.last_text,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

function getSessionRow(id) {
  return db.prepare('SELECT * FROM live_sessions WHERE id = ?').get(id);
}

function getRuntimeAvatarId(runtime = {}) {
  return trimText(runtime.livetalkingAvatarId || runtime.avatarId || runtime.preprocessedAvatarId || '');
}

function readAvatarRuntime(row) {
  const imageSettings = fromJson(row?.image_settings, {});
  return imageSettings.liveRuntime || {};
}

function findDefaultOutputAvatar(requestedAvatarId = '') {
  const requested = trimText(requestedAvatarId || process.env.LIVETALKING_AVATAR_ID);
  if (requested) {
    return {
      avatarId: requested,
      avatarName: requested,
      status: 'specified',
    };
  }

  const rows = db.prepare('SELECT id, name, image_settings, updated_at FROM avatars ORDER BY updated_at DESC').all();
  const candidates = rows
    .map((row) => {
      const runtime = readAvatarRuntime(row);
      return {
        avatarId: getRuntimeAvatarId(runtime),
        avatarName: row.name || row.id,
        status: runtime.status || '',
        modelRoute: runtime.modelRoute || '',
      };
    })
    .filter((item) => item.avatarId);

  return candidates.find((item) => item.status === 'ready') || candidates[0] || {
    avatarId: '',
    avatarName: 'LiveTalking 默认形象',
    status: 'default',
  };
}

function readOutputRuntime() {
  const row = db.prepare('SELECT * FROM obs_local_config WHERE id = ?').get(CONFIG_ID);

  return {
    sessionId: row?.output_runtime_session_id || '',
    liveSessionId: row?.output_runtime_live_session_id || '',
    avatarId: row?.output_runtime_avatar_id || '',
    status: row?.output_runtime_status || 'idle',
    updatedAt: row?.output_runtime_updated_at || '',
  };
}

function updateOutputRuntime(runtime = {}) {
  const timestamp = now();

  db.prepare(
    `INSERT INTO obs_local_config (
      id, output_runtime_session_id, output_runtime_live_session_id,
      output_runtime_avatar_id, output_runtime_status, output_runtime_updated_at,
      updated_at
    ) VALUES (
      @id, @runtimeSessionId, @liveSessionId,
      @avatarId, @status, @runtimeUpdatedAt,
      @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      output_runtime_session_id = excluded.output_runtime_session_id,
      output_runtime_live_session_id = excluded.output_runtime_live_session_id,
      output_runtime_avatar_id = excluded.output_runtime_avatar_id,
      output_runtime_status = excluded.output_runtime_status,
      output_runtime_updated_at = excluded.output_runtime_updated_at,
      updated_at = excluded.updated_at`,
  ).run({
    id: CONFIG_ID,
    runtimeSessionId: runtime.sessionId || '',
    liveSessionId: runtime.liveSessionId || '',
    avatarId: runtime.avatarId || '',
    status: runtime.status || 'idle',
    runtimeUpdatedAt: timestamp,
    updatedAt: timestamp,
  });

  return readOutputRuntime();
}

router.get('/obs-output/runtime', (req, res) => {
  return success(res, { runtime: readOutputRuntime() });
});

router.post('/obs-output/runtime/clear', (req, res) => {
  return success(res, {
    runtime: updateOutputRuntime({
      sessionId: '',
      liveSessionId: req.body?.liveSessionId || '',
      avatarId: req.body?.avatarId || '',
      status: 'closed',
    }),
  });
});

router.post('/obs-output/sessions', async (req, res) => {
  const body = req.body || {};
  const outputAvatar = findDefaultOutputAvatar(body.avatar || body.avatarId || body.figureId);
  const provider = getDigitalHumanMode(body.provider || 'livetalking');
  const adapter = getDigitalHumanAdapter({ provider });

  let opened;
  try {
    opened = await adapter.openSession({
      figureId: outputAvatar.avatarId,
      mode: body.mode || 'obs-output',
      roomName: body.roomName || 'OBS 数字人输出页',
      voiceEngine: body.voiceEngine || '',
      cloneMode: body.cloneMode || '',
    });
  } catch (error) {
    return fail(res, error.message || 'OBS 输出页开播失败', SERVER_ERROR);
  }

  const id = nextId('live_sessions', 'LS');
  const timestamp = now();
  db.prepare(
    `INSERT INTO live_sessions (
      id, room_id, room_name, figure_id, mode, provider, status, stream_url,
      last_text, started_at, ended_at, created_at, updated_at
    ) VALUES (
      @id, @roomId, @roomName, @figureId, @mode, @provider, @status, @streamUrl,
      '', @startedAt, '', @createdAt, @updatedAt
    )`,
  ).run({
    id,
    roomId: body.roomId || 'OBS_OUTPUT',
    roomName: body.roomName || 'OBS 数字人输出页',
    figureId: outputAvatar.avatarId,
    mode: opened.mode || body.mode || 'obs-output',
    provider: opened.provider || provider,
    status: opened.status || 'ready',
    streamUrl: opened.streamUrl || '',
    startedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  updateOutputRuntime({
    sessionId: '',
    liveSessionId: id,
    avatarId: outputAvatar.avatarId,
    status: 'opening',
  });

  return success(
    res,
    {
      session: mapSession(getSessionRow(id)),
      avatar: outputAvatar,
      provider: opened.provider || provider,
      note: opened.note || '',
    },
    'created',
  );
});

router.post('/obs-output/sessions/:id/connect', async (req, res) => {
  const row = getSessionRow(req.params.id);
  if (!row) return fail(res, 'OBS 输出页会话不存在', 40400, { id: req.params.id });
  if (!OPEN_STATUSES.has(row.status)) {
    return fail(res, 'OBS 输出页会话未就绪或已结束', 40001, { status: row.status });
  }

  const adapter = getDigitalHumanAdapter({ provider: row.provider });
  if (typeof adapter.connectWebRtc !== 'function') {
    return fail(res, '当前数字人引擎不支持本机 WebRTC 输出', 40001, { provider: row.provider });
  }

  try {
    const avatarId = trimText(req.body?.avatar || row.figure_id);
    const result = await adapter.connectWebRtc({
      sdp: req.body?.sdp || '',
      type: req.body?.type || 'offer',
      avatar: avatarId,
      refaudio: req.body?.refaudio || '',
      reftext: req.body?.reftext || '',
    });
    const runtime = updateOutputRuntime({
      sessionId: result.sessionid || '',
      liveSessionId: row.id,
      avatarId,
      status: 'connected',
    });

    return success(res, {
      provider: result.provider || row.provider,
      runtime,
      sessionid: result.sessionid || '',
      sdp: result.sdp,
      type: result.type || 'answer',
    });
  } catch (error) {
    updateOutputRuntime({
      sessionId: '',
      liveSessionId: row.id,
      avatarId: row.figure_id || '',
      status: 'failed',
    });
    return fail(res, error.message || 'OBS 输出页画面连接失败', SERVER_ERROR);
  }
});

export default router;
