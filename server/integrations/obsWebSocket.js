const DEFAULT_OBS_URL = 'ws://127.0.0.1:4455';
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_BROWSER_SOURCE_NAME = '数字人直播画面';
const DEFAULT_BROWSER_SOURCE_URL = process.env.OBS_BROWSER_SOURCE_URL || 'http://127.0.0.1:5173/obs/output';
const DEFAULT_SOURCE_WIDTH = 1080;
const DEFAULT_SOURCE_HEIGHT = 1920;

function normalizeTimeout(value) {
  const timeout = Number(value || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(timeout) ? Math.min(Math.max(timeout, 1000), 30000) : DEFAULT_TIMEOUT_MS;
}

function withTimeout(promise, timeoutMs, message) {
  let timer;

  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

function sanitizeObsError(error, password = '') {
  let message = String(error?.message || error?.code || error || 'OBS connection failed');
  message = message.replace(/password=[^&\s]+/gi, 'password=[hidden]');

  if (password) {
    message = message.split(password).join('[hidden]');
  }

  if (/ECONNREFUSED|failed to fetch|connect/i.test(message)) {
    return `${message}。请确认 OBS 已启动，并在 工具 / WebSocket 服务器设置 中启用服务。`;
  }

  if (/auth|password|authentication/i.test(message)) {
    return `${message}。请确认 OBS WebSocket 密码是否正确。`;
  }

  return message;
}

function normalizeConfig(config = {}) {
  return {
    obsUrl: String(config.obsUrl || config.url || DEFAULT_OBS_URL).trim(),
    obsPassword: String(config.obsPassword || config.password || '').trim(),
    obsTimeoutMs: normalizeTimeout(config.obsTimeoutMs || config.timeoutMs),
    sceneName: String(config.sceneName || '').trim(),
    browserSourceName: String(config.browserSourceName || DEFAULT_BROWSER_SOURCE_NAME).trim(),
    browserSourceUrl: String(config.browserSourceUrl || DEFAULT_BROWSER_SOURCE_URL).trim(),
    browserSourceWidth: Number(config.browserSourceWidth || DEFAULT_SOURCE_WIDTH),
    browserSourceHeight: Number(config.browserSourceHeight || DEFAULT_SOURCE_HEIGHT),
  };
}

async function loadObsWebSocket() {
  try {
    const mod = await import('obs-websocket-js/json');
    return mod.OBSWebSocket || mod.default;
  } catch {
    const localSdkUrl = new URL('../../executor-client/node_modules/obs-websocket-js/dist/json.js', import.meta.url).href;
    const mod = await import(localSdkUrl);
    return mod.OBSWebSocket || mod.default;
  }
}

async function createObsConnection(rawConfig = {}) {
  const config = normalizeConfig(rawConfig);
  const OBSWebSocket = await loadObsWebSocket();
  const obs = new OBSWebSocket();

  try {
    const connectResult = await withTimeout(
      obs.connect(config.obsUrl, config.obsPassword || undefined, { rpcVersion: 1 }),
      config.obsTimeoutMs,
      `OBS connection timeout: ${config.obsTimeoutMs}ms`,
    );

    return {
      obs,
      config,
      connectResult,
    };
  } catch (error) {
    await disconnectObs(obs);
    throw new Error(sanitizeObsError(error, config.obsPassword));
  }
}

async function disconnectObs(obs) {
  if (!obs) return;

  try {
    await obs.disconnect();
  } catch {
    // Ignore disconnect failures.
  }
}

async function callOptional(obs, requestType, requestData = {}, fallback = null) {
  try {
    return await obs.call(requestType, requestData);
  } catch {
    return fallback;
  }
}

function mapFps(videoSettings = {}) {
  const numerator = Number(videoSettings.fpsNumerator || 0);
  const denominator = Number(videoSettings.fpsDenominator || 0);

  if (numerator > 0 && denominator > 0) {
    return Math.round(numerator / denominator);
  }

  return Number(videoSettings.fps || 0);
}

function mapResolution(videoSettings = {}) {
  const width = videoSettings.outputWidth || videoSettings.baseWidth || 0;
  const height = videoSettings.outputHeight || videoSettings.baseHeight || 0;

  return width && height ? `${width}x${height}` : '未设置';
}

function buildScreenshotSize(config = {}) {
  const sourceWidth = Number(config.browserSourceWidth || DEFAULT_SOURCE_WIDTH);
  const sourceHeight = Number(config.browserSourceHeight || DEFAULT_SOURCE_HEIGHT);
  const width = Math.min(Math.max(sourceWidth || DEFAULT_SOURCE_WIDTH, 320), 540);
  const ratio = sourceWidth > 0 ? sourceHeight / sourceWidth : DEFAULT_SOURCE_HEIGHT / DEFAULT_SOURCE_WIDTH;
  const height = Math.min(Math.max(Math.round(width * ratio), 320), 960);

  return { width, height };
}

function normalizeScreenshotData(result = {}) {
  const imageData = result.imageData || result.imageDataUrl || result.image || '';

  if (!imageData) {
    return '';
  }

  return String(imageData).startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;
}

function mapVirtualCameraStatus(result) {
  return result?.outputActive ? '已开启' : '未开启';
}

function mapSceneSources(sceneName, sceneItems = []) {
  return sceneItems.map((item) => ({
    sceneName,
    name: item.sourceName || item.inputName || '',
    type: item.sourceType || item.inputKind || item.sourceKind || '',
    status: item.sceneItemEnabled === false ? '未启用' : '存在',
    sceneItemId: item.sceneItemId,
    enabled: item.sceneItemEnabled !== false,
  }));
}

async function collectStatusFromConnection(obs, connectResult = {}) {
  const [version, currentProgramScene, videoSettings, virtualCamera] = await Promise.all([
    obs.call('GetVersion'),
    obs.call('GetCurrentProgramScene'),
    callOptional(obs, 'GetVideoSettings', {}, {}),
    callOptional(obs, 'GetVirtualCamStatus', {}, null),
  ]);

  return {
    obsStatus: '已连接',
    obsVersion: version.obsVersion || version.obsWebSocketVersion || connectResult.obsWebSocketVersion || 'unknown',
    obsWebSocketVersion: version.obsWebSocketVersion || connectResult.obsWebSocketVersion || 'unknown',
    negotiatedRpcVersion: connectResult.negotiatedRpcVersion,
    currentScene: currentProgramScene.currentProgramSceneName || '',
    resolution: mapResolution(videoSettings),
    fps: mapFps(videoSettings),
    virtualCameraStatus: mapVirtualCameraStatus(virtualCamera),
    outputStatus: '预览中',
    errorMessage: '无',
    checkedAt: new Date().toISOString(),
  };
}

async function collectScenesFromConnection(obs, connectResult = {}) {
  const [status, sceneList] = await Promise.all([
    collectStatusFromConnection(obs, connectResult),
    obs.call('GetSceneList'),
  ]);
  const sceneNames = Array.isArray(sceneList.scenes)
    ? sceneList.scenes.map((scene) => scene.sceneName).filter(Boolean)
    : [];
  const scenes = [];

  for (const sceneName of sceneNames) {
    const sceneItems = await callOptional(obs, 'GetSceneItemList', { sceneName }, { sceneItems: [] });
    scenes.push({
      name: sceneName,
      sources: mapSceneSources(sceneName, sceneItems?.sceneItems || []),
    });
  }

  const sceneSources = scenes.flatMap((scene) => scene.sources);

  return {
    ...status,
    scenes,
    sceneSources,
    sourceCount: sceneSources.length,
  };
}

export async function testObsConnection(rawConfig = {}) {
  let connected;

  try {
    connected = await createObsConnection(rawConfig);
    return await collectStatusFromConnection(connected.obs, connected.connectResult);
  } finally {
    await disconnectObs(connected?.obs);
  }
}

export async function refreshObsScenes(rawConfig = {}) {
  let connected;

  try {
    connected = await createObsConnection(rawConfig);
    return await collectScenesFromConnection(connected.obs, connected.connectResult);
  } finally {
    await disconnectObs(connected?.obs);
  }
}

export async function createOrUpdateBrowserSource(rawConfig = {}) {
  let connected;

  try {
    connected = await createObsConnection(rawConfig);
    const { obs, config, connectResult } = connected;
    const status = await collectStatusFromConnection(obs, connectResult);
    const targetSceneName = config.sceneName || status.currentScene;

    if (!targetSceneName) {
      throw new Error('OBS 当前没有可用场景，请先在 OBS 里创建一个场景。');
    }

    const inputList = await callOptional(obs, 'GetInputList', {}, { inputs: [] });
    const existingInput = (inputList.inputs || []).find((item) => item.inputName === config.browserSourceName);
    const inputSettings = {
      url: config.browserSourceUrl,
      width: config.browserSourceWidth,
      height: config.browserSourceHeight,
      reroute_audio: true,
      css: 'body { margin: 0; overflow: hidden; background: #020617; }',
    };

    if (existingInput) {
      await obs.call('SetInputSettings', {
        inputName: config.browserSourceName,
        inputSettings,
        overlay: true,
      });
    } else {
      await obs.call('CreateInput', {
        sceneName: targetSceneName,
        inputName: config.browserSourceName,
        inputKind: 'browser_source',
        inputSettings,
        sceneItemEnabled: true,
      });
    }

    return {
      ...(await collectScenesFromConnection(obs, connectResult)),
      browserSource: {
        sceneName: targetSceneName,
        inputName: config.browserSourceName,
        url: config.browserSourceUrl,
        width: config.browserSourceWidth,
        height: config.browserSourceHeight,
        action: existingInput ? 'updated' : 'created',
      },
    };
  } finally {
    await disconnectObs(connected?.obs);
  }
}

export async function captureObsSourceScreenshot(rawConfig = {}) {
  let connected;

  try {
    connected = await createObsConnection(rawConfig);
    const { obs, config, connectResult } = connected;
    const status = await collectStatusFromConnection(obs, connectResult);
    const { width, height } = buildScreenshotSize(config);
    const sourceName = config.browserSourceName || DEFAULT_BROWSER_SOURCE_NAME;
    const screenshot = await obs.call('GetSourceScreenshot', {
      sourceName,
      imageFormat: 'png',
      imageWidth: width,
      imageHeight: height,
      imageCompressionQuality: 100,
    });
    const imageData = normalizeScreenshotData(screenshot);

    if (!imageData) {
      throw new Error(`OBS 来源 ${sourceName} 未返回截图`);
    }

    return {
      ...status,
      screenshot: {
        sourceName,
        imageData,
        width,
        height,
        capturedAt: new Date().toISOString(),
      },
    };
  } finally {
    await disconnectObs(connected?.obs);
  }
}

export async function setObsVirtualCamera(rawConfig = {}, action = 'start') {
  let connected;

  try {
    connected = await createObsConnection(rawConfig);
    const { obs, connectResult } = connected;
    const before = await callOptional(obs, 'GetVirtualCamStatus', {}, null);
    const shouldStart = action !== 'stop';

    if (shouldStart && !before?.outputActive) {
      await obs.call('StartVirtualCam');
    }

    if (!shouldStart && before?.outputActive) {
      await obs.call('StopVirtualCam');
    }

    return await collectStatusFromConnection(obs, connectResult);
  } finally {
    await disconnectObs(connected?.obs);
  }
}

export { DEFAULT_BROWSER_SOURCE_NAME, DEFAULT_BROWSER_SOURCE_URL, DEFAULT_OBS_URL, DEFAULT_SOURCE_HEIGHT, DEFAULT_SOURCE_WIDTH };
