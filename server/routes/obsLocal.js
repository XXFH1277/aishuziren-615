import express from 'express';
import { db, fromJson, now, toJson } from '../db/database.js';
import {
  DEFAULT_BROWSER_SOURCE_NAME,
  DEFAULT_BROWSER_SOURCE_URL,
  DEFAULT_OBS_URL,
  DEFAULT_SOURCE_HEIGHT,
  DEFAULT_SOURCE_WIDTH,
  captureObsSourceScreenshot,
  createOrUpdateBrowserSource,
  refreshObsScenes,
  setObsVirtualCamera,
  testObsConnection,
} from '../integrations/obsWebSocket.js';
import { decryptSecret, encryptSecret, isEncryptionConfigured } from '../utils/crypto.js';
import { PARAM_ERROR } from '../utils/errorCodes.js';
import { fail, success } from '../utils/response.js';

const router = express.Router();
const CONFIG_ID = 'LOCAL';
const LOCAL_EXECUTOR_ID = 'LOCAL_OBS';
const LOCAL_EXECUTOR_NAME = '本机 OBS WebSocket';
let volatileObsPassword = '';

function trimText(value = '') {
  return String(value || '').trim();
}

function defaultConfig() {
  return {
    id: CONFIG_ID,
    obsUrl: process.env.OBS_URL || DEFAULT_OBS_URL,
    passwordConfigured: Boolean(process.env.OBS_PASSWORD || volatileObsPassword),
    passwordSource: process.env.OBS_PASSWORD ? 'env' : volatileObsPassword ? 'memory' : 'none',
    obsTimeoutMs: 5000,
    sceneName: '',
    browserSourceName: DEFAULT_BROWSER_SOURCE_NAME,
    browserSourceUrl: DEFAULT_BROWSER_SOURCE_URL,
    browserSourceWidth: DEFAULT_SOURCE_WIDTH,
    browserSourceHeight: DEFAULT_SOURCE_HEIGHT,
    outputRuntime: {
      sessionId: '',
      liveSessionId: '',
      avatarId: '',
      status: 'idle',
      updatedAt: '',
    },
    updatedAt: '',
  };
}

function readConfigRow() {
  return db.prepare('SELECT * FROM obs_local_config WHERE id = ?').get(CONFIG_ID);
}

function maskSecret(value = '') {
  if (!value) return '';
  return value.length <= 4 ? '****' : `${value.slice(0, 2)}****${value.slice(-2)}`;
}

function mapConfig(row) {
  const base = defaultConfig();
  if (!row) return base;

  const hasStoredPassword = Boolean(row.password_cipher && row.password_iv && row.password_tag);

  return {
    id: row.id,
    obsUrl: row.obs_url || base.obsUrl,
    passwordConfigured: hasStoredPassword || Boolean(process.env.OBS_PASSWORD || volatileObsPassword),
    passwordSource: hasStoredPassword ? 'encrypted-db' : process.env.OBS_PASSWORD ? 'env' : volatileObsPassword ? 'memory' : 'none',
    passwordMasked: hasStoredPassword ? row.password_masked || '已加密保存' : process.env.OBS_PASSWORD ? '来自环境变量' : volatileObsPassword ? '本次进程临时缓存' : '',
    obsTimeoutMs: Number(row.obs_timeout_ms || base.obsTimeoutMs),
    sceneName: row.scene_name || '',
    browserSourceName: row.browser_source_name || base.browserSourceName,
    browserSourceUrl: row.browser_source_url || base.browserSourceUrl,
    browserSourceWidth: Number(row.browser_source_width || base.browserSourceWidth),
    browserSourceHeight: Number(row.browser_source_height || base.browserSourceHeight),
    outputRuntime: {
      sessionId: row.output_runtime_session_id || '',
      liveSessionId: row.output_runtime_live_session_id || '',
      avatarId: row.output_runtime_avatar_id || '',
      status: row.output_runtime_status || 'idle',
      updatedAt: row.output_runtime_updated_at || '',
    },
    lastStatus: fromJson(row.last_status_json, null),
    updatedAt: row.updated_at || '',
  };
}

function readStoredPassword(row) {
  if (row?.password_cipher && row?.password_iv && row?.password_tag) {
    return decryptSecret({
      cipher: row.password_cipher,
      iv: row.password_iv,
      tag: row.password_tag,
    });
  }

  return process.env.OBS_PASSWORD || volatileObsPassword || '';
}

function buildRuntimeConfig(overrides = {}) {
  const row = readConfigRow();
  const mapped = mapConfig(row);
  const overridePassword = trimText(overrides.password || overrides.obsPassword);

  if (overridePassword && !process.env.OBS_PASSWORD) {
    volatileObsPassword = overridePassword;
  }

  const password = overridePassword || readStoredPassword(row);

  return {
    obsUrl: trimText(overrides.obsUrl) || mapped.obsUrl || DEFAULT_OBS_URL,
    obsPassword: password,
    obsTimeoutMs: Number(overrides.obsTimeoutMs || mapped.obsTimeoutMs || 5000),
    sceneName: trimText(overrides.sceneName) || mapped.sceneName,
    browserSourceName: trimText(overrides.browserSourceName) || mapped.browserSourceName || DEFAULT_BROWSER_SOURCE_NAME,
    browserSourceUrl: trimText(overrides.browserSourceUrl) || mapped.browserSourceUrl || DEFAULT_BROWSER_SOURCE_URL,
    browserSourceWidth: Number(overrides.browserSourceWidth || mapped.browserSourceWidth || DEFAULT_SOURCE_WIDTH),
    browserSourceHeight: Number(overrides.browserSourceHeight || mapped.browserSourceHeight || DEFAULT_SOURCE_HEIGHT),
  };
}

function normalizeSceneSources(snapshot = {}) {
  return Array.isArray(snapshot.sceneSources)
    ? snapshot.sceneSources.map((source) => ({
        sceneName: source.sceneName || '',
        name: source.name || '',
        type: source.type || '',
        status: source.status || '存在',
        sceneItemId: source.sceneItemId,
        enabled: source.enabled !== false,
      }))
    : [];
}

function persistObsSnapshot(snapshot = {}) {
  const timestamp = now();
  const sceneSources = normalizeSceneSources(snapshot);
  const sourceCount = Number(snapshot.sourceCount || sceneSources.length || 0);
  const currentSource = sceneSources.find((item) => item.sceneName === snapshot.currentScene)?.name || sceneSources[0]?.name || '';

  db.prepare(
    `INSERT INTO executor_obs_status (
      id, executor_id, executor_name, obs_status, obs_version, current_scene,
      source_count, resolution, fps, virtual_camera_status, output_status,
      error_message, scene_sources_json, last_connected_at, updated_at
    ) VALUES (
      @id, @executorId, @executorName, @obsStatus, @obsVersion, @currentScene,
      @sourceCount, @resolution, @fps, @virtualCameraStatus, @outputStatus,
      @errorMessage, @sceneSources, @lastConnectedAt, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      executor_name = excluded.executor_name,
      obs_status = excluded.obs_status,
      obs_version = excluded.obs_version,
      current_scene = excluded.current_scene,
      source_count = excluded.source_count,
      resolution = excluded.resolution,
      fps = excluded.fps,
      virtual_camera_status = excluded.virtual_camera_status,
      output_status = excluded.output_status,
      error_message = excluded.error_message,
      scene_sources_json = excluded.scene_sources_json,
      last_connected_at = excluded.last_connected_at,
      updated_at = excluded.updated_at`,
  ).run({
    id: `OBS_${LOCAL_EXECUTOR_ID}`,
    executorId: LOCAL_EXECUTOR_ID,
    executorName: LOCAL_EXECUTOR_NAME,
    obsStatus: snapshot.obsStatus || '未连接',
    obsVersion: snapshot.obsVersion || '未知',
    currentScene: snapshot.currentScene || '无',
    sourceCount,
    resolution: snapshot.resolution || '未设置',
    fps: Number(snapshot.fps || 0),
    virtualCameraStatus: snapshot.virtualCameraStatus || '未开启',
    outputStatus: snapshot.outputStatus || (snapshot.obsStatus === '已连接' ? '预览中' : '未输出'),
    errorMessage: snapshot.errorMessage || '无',
    sceneSources: toJson(sceneSources),
    lastConnectedAt: snapshot.obsStatus === '已连接' ? snapshot.checkedAt || timestamp : '',
    updatedAt: timestamp,
  });

  const checklist = [
    { id: 'OC001', label: 'OBS连接正常', checked: snapshot.obsStatus === '已连接' },
    { id: 'OC002', label: '当前场景存在', checked: Boolean(snapshot.currentScene) },
    { id: 'OC003', label: '数字人浏览器源存在', checked: sceneSources.some((item) => item.name === mapConfig(readConfigRow()).browserSourceName) },
    { id: 'OC004', label: '虚拟摄像头可用', checked: snapshot.virtualCameraStatus === '已开启' },
  ];

  db.prepare(
    `INSERT INTO studio_output_status (
      id, obs_status, virtual_camera_status, window_capture_status, obs_version,
      current_scene, current_source, resolution, fps, last_heartbeat_at,
      scene_mappings_json, checklist_json, updated_at
    ) VALUES (
      @id, @obsStatus, @virtualCameraStatus, @windowCaptureStatus, @obsVersion,
      @currentScene, @currentSource, @resolution, @fps, @lastHeartbeatAt,
      @sceneMappings, @checklist, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      obs_status = excluded.obs_status,
      virtual_camera_status = excluded.virtual_camera_status,
      window_capture_status = excluded.window_capture_status,
      obs_version = excluded.obs_version,
      current_scene = excluded.current_scene,
      current_source = excluded.current_source,
      resolution = excluded.resolution,
      fps = excluded.fps,
      last_heartbeat_at = excluded.last_heartbeat_at,
      scene_mappings_json = excluded.scene_mappings_json,
      checklist_json = excluded.checklist_json,
      updated_at = excluded.updated_at`,
  ).run({
    id: 'SO_LOCAL_OBS',
    obsStatus: snapshot.obsStatus || '未连接',
    virtualCameraStatus: snapshot.virtualCameraStatus || '未开启',
    windowCaptureStatus: '浏览器源',
    obsVersion: snapshot.obsVersion || '未知',
    currentScene: snapshot.currentScene || '无',
    currentSource,
    resolution: snapshot.resolution || '未设置',
    fps: Number(snapshot.fps || 0),
    lastHeartbeatAt: snapshot.checkedAt || timestamp,
    sceneMappings: toJson(
      sceneSources.slice(0, 8).map((source, index) => ({
        id: `OSM${index + 1}`,
        studioLayer: source.name,
        obsSource: source.name,
        sourceType: source.type || 'OBS来源',
        status: source.status || '存在',
      })),
    ),
    checklist: toJson(checklist),
    updatedAt: timestamp,
  });
}

function persistLastStatus(snapshot = {}) {
  const row = readConfigRow();
  const mapped = mapConfig(row);
  const timestamp = now();

  db.prepare(
    `INSERT INTO obs_local_config (
      id, obs_url, password_cipher, password_iv, password_tag, password_masked,
      obs_timeout_ms, scene_name, browser_source_name, browser_source_url,
      browser_source_width, browser_source_height, last_status_json, updated_at
    ) VALUES (
      @id, @obsUrl, @passwordCipher, @passwordIv, @passwordTag, @passwordMasked,
      @obsTimeoutMs, @sceneName, @browserSourceName, @browserSourceUrl,
      @browserSourceWidth, @browserSourceHeight, @lastStatus, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      last_status_json = excluded.last_status_json,
      updated_at = excluded.updated_at`,
  ).run({
    id: CONFIG_ID,
    obsUrl: mapped.obsUrl,
    passwordCipher: row?.password_cipher || '',
    passwordIv: row?.password_iv || '',
    passwordTag: row?.password_tag || '',
    passwordMasked: row?.password_masked || '',
    obsTimeoutMs: mapped.obsTimeoutMs,
    sceneName: mapped.sceneName,
    browserSourceName: mapped.browserSourceName,
    browserSourceUrl: mapped.browserSourceUrl,
    browserSourceWidth: mapped.browserSourceWidth,
    browserSourceHeight: mapped.browserSourceHeight,
    lastStatus: toJson(snapshot),
    updatedAt: timestamp,
  });
}

function saveConfig(body = {}) {
  const row = readConfigRow();
  const current = mapConfig(row);
  const timestamp = now();
  const password = trimText(body.password || body.obsPassword);
  const clearPassword = body.clearPassword === true;
  let encrypted = {
    cipher: row?.password_cipher || '',
    iv: row?.password_iv || '',
    tag: row?.password_tag || '',
  };
  let passwordMasked = row?.password_masked || '';
  let passwordSaveWarning = '';

  if (clearPassword) {
    encrypted = { cipher: '', iv: '', tag: '' };
    passwordMasked = '';
    volatileObsPassword = '';
  } else if (password) {
    if (isEncryptionConfigured()) {
      encrypted = encryptSecret(password);
      passwordMasked = maskSecret(password);
      volatileObsPassword = '';
    } else {
      volatileObsPassword = password;
      passwordSaveWarning = '后端未配置 CRED_ENC_KEY，OBS 密码已作为本次进程临时缓存；重启本地 API 后需要重新填写。';
    }
  }

  db.prepare(
    `INSERT INTO obs_local_config (
      id, obs_url, password_cipher, password_iv, password_tag, password_masked,
      obs_timeout_ms, scene_name, browser_source_name, browser_source_url,
      browser_source_width, browser_source_height, last_status_json, updated_at
    ) VALUES (
      @id, @obsUrl, @passwordCipher, @passwordIv, @passwordTag, @passwordMasked,
      @obsTimeoutMs, @sceneName, @browserSourceName, @browserSourceUrl,
      @browserSourceWidth, @browserSourceHeight, @lastStatus, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      obs_url = excluded.obs_url,
      password_cipher = excluded.password_cipher,
      password_iv = excluded.password_iv,
      password_tag = excluded.password_tag,
      password_masked = excluded.password_masked,
      obs_timeout_ms = excluded.obs_timeout_ms,
      scene_name = excluded.scene_name,
      browser_source_name = excluded.browser_source_name,
      browser_source_url = excluded.browser_source_url,
      browser_source_width = excluded.browser_source_width,
      browser_source_height = excluded.browser_source_height,
      updated_at = excluded.updated_at`,
  ).run({
    id: CONFIG_ID,
    obsUrl: trimText(body.obsUrl) || current.obsUrl || DEFAULT_OBS_URL,
    passwordCipher: encrypted.cipher,
    passwordIv: encrypted.iv,
    passwordTag: encrypted.tag,
    passwordMasked,
    obsTimeoutMs: Number(body.obsTimeoutMs || current.obsTimeoutMs || 5000),
    sceneName: trimText(body.sceneName),
    browserSourceName: trimText(body.browserSourceName) || DEFAULT_BROWSER_SOURCE_NAME,
    browserSourceUrl: trimText(body.browserSourceUrl) || DEFAULT_BROWSER_SOURCE_URL,
    browserSourceWidth: Number(body.browserSourceWidth || DEFAULT_SOURCE_WIDTH),
    browserSourceHeight: Number(body.browserSourceHeight || DEFAULT_SOURCE_HEIGHT),
    lastStatus: row?.last_status_json || null,
    updatedAt: timestamp,
  });

  return {
    config: mapConfig(readConfigRow()),
    passwordSaveWarning,
  };
}

function runObsAction(res, action) {
  return action()
    .then((snapshot) => {
      persistLastStatus(snapshot);
      persistObsSnapshot(snapshot);
      return success(res, {
        status: snapshot,
        obsStatus: snapshot,
      });
    })
    .catch((error) =>
      fail(res, 'OBS 操作失败', PARAM_ERROR, {
        reason: error.message || 'OBS WebSocket 请求失败',
      }),
    );
}

router.get('/obs-local/config', (req, res) => {
  return success(res, {
    config: mapConfig(readConfigRow()),
    encryptionConfigured: isEncryptionConfigured(),
  });
});

router.put('/obs-local/config', (req, res) => {
  try {
    const result = saveConfig(req.body || {});
    return success(res, {
      ...result,
      encryptionConfigured: isEncryptionConfigured(),
    });
  } catch (error) {
    return fail(res, 'OBS 配置保存失败', PARAM_ERROR, {
      reason: error.message,
    });
  }
});

router.post('/obs-local/test', (req, res) => {
  return runObsAction(res, () => testObsConnection(buildRuntimeConfig(req.body || {})));
});

router.post('/obs-local/refresh-scenes', (req, res) => {
  return runObsAction(res, () => refreshObsScenes(buildRuntimeConfig(req.body || {})));
});

router.post('/obs-local/browser-source', (req, res) => {
  return runObsAction(res, () => createOrUpdateBrowserSource(buildRuntimeConfig(req.body || {})));
});

function handleSourceScreenshot(req, res, payload = {}) {
  return captureObsSourceScreenshot(buildRuntimeConfig(payload))
    .then((snapshot) => {
      const { screenshot, ...status } = snapshot;
      persistLastStatus(status);
      persistObsSnapshot(status);
      return success(res, {
        status,
        obsStatus: status,
        screenshot,
      });
    })
    .catch((error) =>
      fail(res, 'OBS 截图读取失败', PARAM_ERROR, {
        reason: error.message || 'OBS WebSocket 截图请求失败',
      }),
    );
}

router.get('/obs-local/source-screenshot', (req, res) => {
  return handleSourceScreenshot(req, res, req.query || {});
});

router.post('/obs-local/source-screenshot', (req, res) => {
  return handleSourceScreenshot(req, res, req.body || {});
});

router.post('/obs-local/virtual-camera', (req, res) => {
  const action = req.body?.action === 'stop' ? 'stop' : 'start';
  return runObsAction(res, () => setObsVirtualCamera(buildRuntimeConfig(req.body || {}), action));
});

export default router;
