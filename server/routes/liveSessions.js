import express from 'express';
import { db, nextId, now } from '../db/database.js';
import {
  getCloneModeOptions,
  getDigitalHumanAdapter,
  getDigitalHumanMode,
  getDigitalHumanProviderOptions,
  getDigitalHumanRuntimeStatus,
  getVoiceEngineOptions,
} from '../integrations/tencentDigitalHuman.js';
import {
  buildComplianceErrorDetail,
  buildComplianceRiskTips,
  checkComplianceText,
  isComplianceBlockingResult,
} from '../utils/compliance.js';
import { SERVER_ERROR } from '../utils/errorCodes.js';
import { fail, success } from '../utils/response.js';

const router = express.Router();
const OPEN_STATUSES = new Set(['ready', 'live']);

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

// 开播：开数字人会话（stub 或腾讯），落库 live_sessions
router.post('/live/sessions', async (req, res) => {
  const body = req.body || {};
  const provider = getDigitalHumanMode(body.provider || body.digitalHumanProvider);
  const adapter = getDigitalHumanAdapter({ provider });

  let opened;
  try {
    opened = await adapter.openSession({
      figureId: body.figureId || '',
      mode: body.mode || 'realtime',
      roomName: body.roomName || '',
      voiceEngine: body.voiceEngine || '',
      cloneMode: body.cloneMode || '',
    });
  } catch (error) {
    return fail(res, error.message || '开播失败', SERVER_ERROR);
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
    roomId: body.roomId || '',
    roomName: body.roomName || '',
    figureId: body.figureId || '',
    mode: opened.mode || body.mode || 'realtime',
    provider: opened.provider || provider,
    status: opened.status || 'ready',
    streamUrl: opened.streamUrl || '',
    startedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return success(
    res,
    {
      session: mapSession(getSessionRow(id)),
      provider: opened.provider || provider,
      note: opened.note || '',
      engine: {
        provider: opened.provider || provider,
        voiceEngine: opened.voiceEngine || body.voiceEngine || '',
        cloneMode: opened.cloneMode || body.cloneMode || '',
        config: opened.config || null,
      },
    },
    'created',
  );
});

router.get('/live/sessions/engines', async (req, res) => {
  const provider = getDigitalHumanMode(req.query.provider || process.env.DIGITAL_HUMAN_PROVIDER || 'livetalking');
  const health = await getDigitalHumanRuntimeStatus({ provider });

  return success(res, {
    providers: getDigitalHumanProviderOptions(),
    voiceEngines: getVoiceEngineOptions(),
    cloneModes: getCloneModeOptions(),
    defaultProvider: provider,
    defaultVoiceEngine: process.env.LIVETALKING_TTS_ENGINE || 'voxcpm2',
    defaultCloneMode: process.env.LIVETALKING_CLONE_MODE || 'hifi',
    health,
  });
});

router.get('/live/sessions/:id', (req, res) => {
  const row = getSessionRow(req.params.id);
  if (!row) return fail(res, '直播会话不存在', 40400, { id: req.params.id });
  return success(res, { session: mapSession(row) });
});

router.post('/live/sessions/:id/connect', async (req, res) => {
  const row = getSessionRow(req.params.id);
  if (!row) return fail(res, '直播会话不存在', 40400, { id: req.params.id });
  if (!OPEN_STATUSES.has(row.status)) {
    return fail(res, '会话未就绪或已结束', 40001, { status: row.status });
  }

  const adapter = getDigitalHumanAdapter({ provider: row.provider });
  if (typeof adapter.connectWebRtc !== 'function') {
    return fail(res, '当前数字人引擎不支持本机 WebRTC 连接', 40001, { provider: row.provider });
  }

  try {
    const result = await adapter.connectWebRtc({
      sdp: req.body?.sdp || '',
      type: req.body?.type || 'offer',
      avatar: req.body?.avatar || '',
      refaudio: req.body?.refaudio || '',
      reftext: req.body?.reftext || '',
    });

    return success(res, {
      provider: result.provider || row.provider,
      sessionid: result.sessionid || '',
      sdp: result.sdp,
      type: result.type || 'answer',
    });
  } catch (error) {
    return fail(res, error.message || '数字人画面连接失败', SERVER_ERROR);
  }
});

// 驱动数字人说话（话术 / 评论回复都走这里），下发前合规复检
router.post('/live/sessions/:id/speak', async (req, res) => {
  const row = getSessionRow(req.params.id);
  if (!row) return fail(res, '直播会话不存在', 40400, { id: req.params.id });
  if (!OPEN_STATUSES.has(row.status)) {
    return fail(res, '会话未就绪或已结束', 40001, { status: row.status });
  }

  const text = String(req.body?.text || '').trim();
  if (!text) return fail(res, '播报文本不能为空', 40001, { field: 'text', reason: 'text 不能为空' });

  const compliance = checkComplianceText(text);
  if (isComplianceBlockingResult(compliance)) {
    return fail(res, '命中高风险合规规则，已拦截', 40001, buildComplianceErrorDetail(compliance));
  }

  const adapter = getDigitalHumanAdapter({ provider: row.provider });
  let result;
  try {
    result = await adapter.driveSpeak({
      sessionId: req.params.id,
      text,
      voiceEngine: req.body?.voiceEngine || '',
      cloneMode: req.body?.cloneMode || '',
      runtimeSessionId: req.body?.runtimeSessionId || req.body?.liveTalkingSessionId || req.body?.sessionid || '',
      interrupt: req.body?.interrupt !== false,
      type: req.body?.type || 'echo',
    });
  } catch (error) {
    return fail(res, error.message || '数字人驱动失败', SERVER_ERROR);
  }

  db.prepare('UPDATE live_sessions SET status = ?, last_text = ?, updated_at = ? WHERE id = ?').run(
    'live',
    text,
    now(),
    req.params.id,
  );

  return success(res, {
    ok: true,
    sentenceId: result.sentenceId || '',
    spokenText: text,
    provider: result.provider || row.provider || getDigitalHumanMode(),
    riskTips: buildComplianceRiskTips(compliance),
  });
});

router.post('/live/sessions/:id/close', async (req, res) => {
  const row = getSessionRow(req.params.id);
  if (!row) return fail(res, '直播会话不存在', 40400, { id: req.params.id });

  const adapter = getDigitalHumanAdapter({ provider: row.provider });
  try {
    await adapter.closeSession({ sessionId: req.params.id });
  } catch {
    // 即使关闭失败也标记结束，避免会话悬挂
  }

  const timestamp = now();
  db.prepare('UPDATE live_sessions SET status = ?, ended_at = ?, updated_at = ? WHERE id = ?').run(
    'ended',
    timestamp,
    timestamp,
    req.params.id,
  );

  return success(res, { session: mapSession(getSessionRow(req.params.id)) });
});

export default router;
