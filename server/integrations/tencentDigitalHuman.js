const DEFAULT_LIVETALKING_BASE_URL = 'http://127.0.0.1:8010';
const DEFAULT_SPEAK_TIMEOUT_MS = 90000;
const DEFAULT_LIVETALKING_AVATAR_DATA_DIR = 'F:\\AIshuziren\\open-digital-human\\repos\\LiveTalking\\data\\avatars';

function isTencentEnabled() {
  return String(process.env.TENCENT_DH_ENABLED || '').trim().toLowerCase() === 'true';
}

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function getConfiguredProvider() {
  return process.env.DIGITAL_HUMAN_PROVIDER || process.env.DH_PROVIDER || (isTencentEnabled() ? 'tencent' : 'stub');
}

function normalizeProvider(value) {
  const provider = String(value || getConfiguredProvider()).trim().toLowerCase();

  if (['local', 'live-talking', 'live_talking', 'livetalking'].includes(provider)) {
    return 'livetalking';
  }

  if (provider === 'tencent') {
    return 'tencent';
  }

  return 'stub';
}

function normalizeCloneMode(value) {
  const mode = String(value || process.env.LIVETALKING_CLONE_MODE || 'reference').trim().toLowerCase();
  return mode === 'hifi' || mode === 'hi-fi' ? 'hifi' : 'reference';
}

function normalizeVoiceEngine(value) {
  const engine = String(value || process.env.LIVETALKING_TTS_ENGINE || 'voxcpm2').trim().toLowerCase();

  if (['gpt-sovits', 'gptsovits', 'gpt_sovits'].includes(engine)) {
    return 'gpt-sovits';
  }

  if (['voxcpm', 'voxcpm2', 'vox-cpm2', 'vox_cpm2'].includes(engine)) {
    return 'voxcpm2';
  }

  return engine || 'voxcpm2';
}

function getLiveTalkingBaseUrl() {
  return stripTrailingSlash(process.env.LIVETALKING_BASE_URL || DEFAULT_LIVETALKING_BASE_URL);
}

function getLiveTalkingPreviewUrl() {
  return process.env.LIVETALKING_PREVIEW_URL || `${getLiveTalkingBaseUrl()}/index.html`;
}

function getLiveTalkingAvatarDataDir() {
  return process.env.LIVETALKING_AVATAR_DATA_DIR || DEFAULT_LIVETALKING_AVATAR_DATA_DIR;
}

async function requestJson(url, { method = 'GET', body, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const raw = await response.text();
    let payload = {};

    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = { raw };
      }
    }

    if (!response.ok) {
      throw new Error(payload?.message || payload?.msg || `HTTP ${response.status}`);
    }

    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`request timeout after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function getLiveTalkingConfig(payload = {}) {
  return payload.config || payload.data?.config || payload.data || payload;
}

async function readLiveTalkingConfig() {
  const payload = await requestJson(`${getLiveTalkingBaseUrl()}/api/admin/config`, { timeoutMs: 5000 });
  return getLiveTalkingConfig(payload);
}

function unwrapLiveTalkingApiResult(payload = {}) {
  if (payload?.code !== undefined && Number(payload.code) !== 0) {
    throw new Error(payload.msg || payload.message || 'LiveTalking API returned an error');
  }

  return payload.data || payload;
}

function buildLiveTalkingNote(config, voiceEngine) {
  const model = config.model || config.modelName || 'unknown';
  const avatarId = config.avatar_id || config.avatarId || config.avatar || 'unknown';
  const runningTts = normalizeVoiceEngine(config.tts || config.ttsEngine || config.tts_engine || voiceEngine);
  const requestedTts = normalizeVoiceEngine(voiceEngine);

  if (runningTts && requestedTts && runningTts !== requestedTts) {
    return `LiveTalking is running ${runningTts}; selected ${requestedTts} will take effect after restarting LiveTalking with that TTS engine.`;
  }

  return `LiveTalking ready: ${model} / ${avatarId} / ${runningTts}.`;
}

const liveTalkingAdapter = {
  id: 'livetalking',

  async health() {
    try {
      const config = await readLiveTalkingConfig();
      return {
        ok: true,
        provider: 'livetalking',
        baseUrl: getLiveTalkingBaseUrl(),
        previewUrl: getLiveTalkingPreviewUrl(),
        config,
      };
    } catch (error) {
      return {
        ok: false,
        provider: 'livetalking',
        baseUrl: getLiveTalkingBaseUrl(),
        previewUrl: getLiveTalkingPreviewUrl(),
        message: error.message || 'LiveTalking service is unavailable',
      };
    }
  },

  async openSession({ figureId = '', mode = 'realtime', voiceEngine = '', cloneMode = '' } = {}) {
    const engine = normalizeVoiceEngine(voiceEngine);
    const config = await readLiveTalkingConfig();

    return {
      status: 'ready',
      streamUrl: getLiveTalkingPreviewUrl(),
      mode,
      figureId,
      provider: 'livetalking',
      voiceEngine: engine,
      cloneMode: normalizeCloneMode(cloneMode),
      note: buildLiveTalkingNote(config, engine),
      config,
    };
  },

  async connectWebRtc({ sdp = '', type = 'offer', avatar = '', refaudio = '', reftext = '' } = {}) {
    if (!sdp) {
      throw new Error('WebRTC offer sdp is required');
    }

    const body = {
      sdp,
      type,
    };

    if (avatar) body.avatar = avatar;
    if (refaudio) body.refaudio = refaudio;
    if (reftext) body.reftext = reftext;

    const answer = await requestJson(`${getLiveTalkingBaseUrl()}/offer`, {
      method: 'POST',
      body,
      timeoutMs: 30000,
    });

    if (!answer?.sdp) {
      throw new Error(answer?.msg || answer?.message || 'LiveTalking WebRTC answer is invalid');
    }

    return {
      provider: 'livetalking',
      sessionid: answer.sessionid || '',
      sdp: answer.sdp,
      type: answer.type || 'answer',
    };
  },

  async driveSpeak({ text = '', voiceEngine = '', cloneMode = '', runtimeSessionId = '', interrupt = true, type = 'echo' } = {}) {
    if (!runtimeSessionId) {
      throw new Error('LiveTalking 尚未建立视频连接：请先点击“开播”，等待数字人画面连接成功后再播报。');
    }

    const payload = {
      type,
      text,
      interrupt,
      sessionid: String(runtimeSessionId),
      tts: {
        engine: normalizeVoiceEngine(voiceEngine),
        clone_mode: normalizeCloneMode(cloneMode),
      },
    };

    const timeoutMs = Number(process.env.LIVETALKING_SPEAK_TIMEOUT_MS || DEFAULT_SPEAK_TIMEOUT_MS);
    const result = await requestJson(`${getLiveTalkingBaseUrl()}/human`, {
      method: 'POST',
      body: payload,
      timeoutMs,
    });

    if (result?.code !== undefined && Number(result.code) !== 0) {
      const message = result.msg || result.message || 'LiveTalking speak failed';

      if (String(message).toLowerCase().includes('session not found')) {
        throw new Error('LiveTalking 没有可用 WebRTC 会话：请点击“开播”重新建立数字人画面连接，看到画面后再播报。');
      }

      throw new Error(message);
    }

    return {
      ok: true,
      sentenceId: result.sentenceId || result.id || `livetalking_${Date.now()}`,
      spokenText: text,
      provider: 'livetalking',
      result,
    };
  },

  async closeSession() {
    return { ok: true, provider: 'livetalking' };
  },
};

const realAdapter = {
  id: 'tencent',

  async openSession() {
    throw new Error('Tencent digital human adapter is not wired yet.');
  },

  async driveSpeak() {
    throw new Error('Tencent text-drive adapter is not wired yet.');
  },

  async closeSession() {
    throw new Error('Tencent close-session adapter is not wired yet.');
  },
};

const stubAdapter = {
  id: 'stub',

  async health() {
    return {
      ok: true,
      provider: 'stub',
      baseUrl: '',
      previewUrl: process.env.DH_STUB_STREAM_URL || '',
      message: 'Stub is available for UI flow testing only.',
    };
  },

  async openSession({ figureId = '', mode = 'realtime' } = {}) {
    return {
      status: 'ready',
      streamUrl: process.env.DH_STUB_STREAM_URL || '',
      mode,
      figureId,
      provider: 'stub',
      note: 'Local stub opened. It does not call TTS, lip sync, OBS, or streaming services.',
    };
  },

  async driveSpeak({ text = '' } = {}) {
    return { ok: true, sentenceId: `stub_${Date.now()}`, spokenText: text, provider: 'stub' };
  },

  async closeSession() {
    return { ok: true, provider: 'stub' };
  },
};

export function getDigitalHumanMode(provider) {
  return normalizeProvider(provider);
}

export function getDigitalHumanAdapter(options = {}) {
  const provider = normalizeProvider(options.provider);

  if (provider === 'livetalking') {
    return liveTalkingAdapter;
  }

  if (provider === 'tencent') {
    return realAdapter;
  }

  return stubAdapter;
}

export function getDigitalHumanProviderOptions() {
  return [
    { label: '本机 LiveTalking', value: 'livetalking' },
    { label: '本机 Stub', value: 'stub' },
    { label: '腾讯云数字人', value: 'tencent' },
  ];
}

export function getVoiceEngineOptions() {
  return [
    { label: 'VoxCPM2', value: 'voxcpm2' },
    { label: 'GPT-SoVITS', value: 'gpt-sovits' },
  ];
}

export function getCloneModeOptions() {
  return [
    { label: '普通克隆', value: 'reference' },
    { label: 'Hi-Fi 深度克隆', value: 'hifi' },
  ];
}

export async function getDigitalHumanRuntimeStatus(options = {}) {
  const adapter = getDigitalHumanAdapter(options);

  if (typeof adapter.health === 'function') {
    return adapter.health();
  }

  return { ok: true, provider: adapter.id };
}

export async function createLiveTalkingAvatarTask(payload = {}) {
  const result = await requestJson(`${getLiveTalkingBaseUrl()}/api/avatar/task`, {
    method: 'POST',
    body: payload,
    timeoutMs: 30000,
  });

  return unwrapLiveTalkingApiResult(result);
}

export async function getLiveTalkingAvatarTask(taskId) {
  const result = await requestJson(`${getLiveTalkingBaseUrl()}/api/avatar/task/${encodeURIComponent(taskId)}`, {
    timeoutMs: 10000,
  });

  return unwrapLiveTalkingApiResult(result);
}

export function getLiveTalkingAvatarPath(avatarId) {
  return `${getLiveTalkingAvatarDataDir()}\\${avatarId}`;
}
