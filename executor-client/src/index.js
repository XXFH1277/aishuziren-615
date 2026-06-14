import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OBSWebSocket } from 'obs-websocket-js';
import { createDigitalHumanAdapter } from './adapters/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, '..');
const devicePath = path.join(clientRoot, '.device.json');
const localConfigPath = path.join(clientRoot, 'config.local.json');

const CLIENT_VERSION = '0.3.0';
const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_OBS_URL = 'ws://127.0.0.1:4455';
const DEFAULT_HEARTBEAT_INTERVAL_SECONDS = 10;
const DEFAULT_REQUEST_TIMEOUT_MS = 8000;
const DEFAULT_OBS_TIMEOUT_MS = 5000;
const MAX_BACKOFF_MS = 60_000;
const KNOWN_PRINT_ONLY_COMMANDS = new Set(['restart', 'refresh_config', 'unbind']);
const OBS_COMMANDS = new Set(['obs_test', 'refresh_obs_scenes']);
const DIGITAL_HUMAN_COMMANDS = new Set(['speak']);

let stopping = false;
let previousCpuSnapshot = readCpuSnapshot();

function log(message, detail = '') {
  const suffix = detail ? ` ${detail}` : '';
  console.log(`[executor-client] ${new Date().toISOString()} ${message}${suffix}`);
}

function readJsonFile(filePath, fallback = {}) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    log(`Failed to parse local config: ${filePath}`, error.message);
    return fallback;
  }
}

function writeJsonFile(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readConfigString(envName, localConfig, key, fallback = '') {
  if (Object.prototype.hasOwnProperty.call(process.env, envName)) {
    return String(process.env[envName] || '').trim();
  }

  if (Object.prototype.hasOwnProperty.call(localConfig, key)) {
    return String(localConfig[key] || '').trim();
  }

  return fallback;
}

function loadConfig() {
  const localConfig = readJsonFile(localConfigPath, {});
  const obsUrl = readConfigString('OBS_URL', localConfig, 'obsUrl', DEFAULT_OBS_URL);

  return {
    baseUrl: readConfigString('EXECUTOR_BASE_URL', localConfig, 'baseUrl', DEFAULT_BASE_URL).replace(/\/+$/, ''),
    bindCode: readConfigString('BIND_CODE', localConfig, 'bindCode', ''),
    heartbeatIntervalSeconds: Number(
      process.env.HEARTBEAT_INTERVAL_SECONDS ||
        localConfig.heartbeatIntervalSeconds ||
        DEFAULT_HEARTBEAT_INTERVAL_SECONDS,
    ),
    requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || localConfig.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS),
    obsUrl,
    obsPassword: readConfigString('OBS_PASSWORD', localConfig, 'obsPassword', ''),
    obsTimeoutMs: Number(process.env.OBS_TIMEOUT_MS || localConfig.obsTimeoutMs || DEFAULT_OBS_TIMEOUT_MS),
    dhAdapter: readConfigString('DH_ADAPTER', localConfig, 'dhAdapter', 'print').toLowerCase() || 'print',
    duix: localConfig.duix || {},
    siyu: localConfig.siyu || {},
    print: localConfig.print || {},
  };
}

function loadDevice() {
  const device = readJsonFile(devicePath, null);

  if (!device?.executorId || !device?.deviceToken) {
    return null;
  }

  return {
    ...device,
    ackedCommandIds: Array.isArray(device.ackedCommandIds) ? device.ackedCommandIds : [],
  };
}

function saveDevice(device) {
  const ackedCommandIds = Array.from(new Set(device.ackedCommandIds || [])).slice(-200);

  writeJsonFile(devicePath, {
    executorId: device.executorId,
    deviceName: device.deviceName,
    baseUrl: device.baseUrl,
    registeredAt: device.registeredAt,
    deviceToken: device.deviceToken,
    ackedCommandIds,
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readCpuSnapshot() {
  return os.cpus().reduce(
    (memo, cpu) => {
      const idle = cpu.times.idle;
      const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0);

      return {
        idle: memo.idle + idle,
        total: memo.total + total,
      };
    },
    { idle: 0, total: 0 },
  );
}

function getCpuUsagePercent() {
  const current = readCpuSnapshot();
  const idleDelta = current.idle - previousCpuSnapshot.idle;
  const totalDelta = current.total - previousCpuSnapshot.total;
  previousCpuSnapshot = current;

  if (totalDelta <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((1 - idleDelta / totalDelta) * 100)));
}

function getMemoryUsagePercent() {
  const total = os.totalmem();
  const free = os.freemem();

  if (!total) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(((total - free) / total) * 100)));
}

class ApiError extends Error {
  constructor(message, { status = 0, code = 0 } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

async function apiRequest(config, pathName, { method = 'GET', body, token } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  const headers = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${config.baseUrl}${pathName}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let payload;

    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiError(`Backend returned non-JSON content: HTTP ${response.status}`, { status: response.status });
    }

    if (!response.ok || payload.code !== 0) {
      throw new ApiError(payload.message || `Request failed: HTTP ${response.status}`, {
        status: response.status,
        code: payload.code,
      });
    }

    return payload.data || {};
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError(`Request timeout: ${config.requestTimeoutMs}ms`, { status: 0 });
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(`Backend unavailable: ${error.message || 'network error'}`, { status: 0 });
  } finally {
    clearTimeout(timeout);
  }
}

function buildRegisterPayload() {
  return {
    name: `${os.hostname()} Executor`,
    deviceName: os.hostname(),
    deviceId: `${os.platform()}-${os.arch()}-${os.hostname()}`,
    os: `${os.type()} ${os.release()}`,
    version: CLIENT_VERSION,
  };
}

async function ensureRegistered(config, currentDevice) {
  if (currentDevice?.executorId && currentDevice?.deviceToken) {
    return currentDevice;
  }

  if (!config.bindCode) {
    log('No local device token or BIND_CODE. Generate a bind code in the admin UI first.');
    return null;
  }

  log('Registering executor with bind code.');
  const data = await apiRequest(config, '/api/executors/register', {
    method: 'POST',
    body: {
      ...buildRegisterPayload(),
      bindCode: config.bindCode,
    },
  });

  if (!data.executor?.id || !data.deviceToken) {
    throw new ApiError('Register response missing executor or deviceToken.');
  }

  const nextDevice = {
    executorId: data.executor.id,
    deviceName: data.executor.deviceName || os.hostname(),
    baseUrl: config.baseUrl,
    registeredAt: new Date().toISOString(),
    deviceToken: data.deviceToken,
    ackedCommandIds: [],
  };

  saveDevice(nextDevice);
  log(`Registered executorId=${nextDevice.executorId}. Device token saved locally.`);

  return nextDevice;
}

function isObsConfigured(config) {
  return Boolean(config.obsUrl && !['false', 'disabled', 'off'].includes(String(config.obsUrl).toLowerCase()));
}

function normalizeObsError(error) {
  return String(error?.message || error?.code || error || 'OBS connection failed').replace(configSecretPattern(), '[hidden]');
}

function configSecretPattern() {
  return /password=[^&\s]+/gi;
}

async function createObsConnection(config) {
  if (!isObsConfigured(config)) {
    throw new Error('OBS is not configured. Set OBS_URL or use the default ws://127.0.0.1:4455.');
  }

  const obs = new OBSWebSocket();
  let connectResult;

  try {
    connectResult = await withTimeout(
      obs.connect(config.obsUrl, config.obsPassword || undefined, { rpcVersion: 1 }),
      config.obsTimeoutMs,
      `OBS connection timeout: ${config.obsTimeoutMs}ms`,
    );
  } catch (error) {
    await disconnectObs(obs);
    throw error;
  }

  return { obs, connectResult };
}

async function disconnectObs(obs) {
  if (!obs) {
    return;
  }

  try {
    await obs.disconnect();
  } catch {
    // Ignore disconnect failures.
  }
}

async function getVirtualCameraStatus(obs) {
  try {
    const result = await obs.call('GetVirtualCamStatus');
    return result.outputActive ? '已连接' : '未连接';
  } catch {
    return '未连接';
  }
}

async function getObsStatusSnapshot(config) {
  let obs;

  try {
    const connected = await createObsConnection(config);
    obs = connected.obs;
    const [version, currentProgramScene, virtualCameraStatus] = await Promise.all([
      obs.call('GetVersion'),
      obs.call('GetCurrentProgramScene'),
      getVirtualCameraStatus(obs),
    ]);

    return {
      obsStatus: '已连接',
      virtualCameraStatus,
      obsVersion: version.obsVersion || version.obsWebSocketVersion || connected.connectResult.obsWebSocketVersion || 'unknown',
      obsWebSocketVersion: version.obsWebSocketVersion || connected.connectResult.obsWebSocketVersion || 'unknown',
      negotiatedRpcVersion: connected.connectResult.negotiatedRpcVersion,
      currentScene: currentProgramScene.currentProgramSceneName || '',
      errorMessage: '',
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      obsStatus: isObsConfigured(config) ? '连接异常' : '未连接',
      virtualCameraStatus: '未连接',
      obsVersion: 'unknown',
      obsWebSocketVersion: 'unknown',
      currentScene: '',
      errorMessage: normalizeObsError(error),
      checkedAt: new Date().toISOString(),
    };
  } finally {
    await disconnectObs(obs);
  }
}

async function collectObsScenes(config) {
  let obs;

  try {
    const connected = await createObsConnection(config);
    obs = connected.obs;
    const [version, sceneList, currentProgramScene, virtualCameraStatus] = await Promise.all([
      obs.call('GetVersion'),
      obs.call('GetSceneList'),
      obs.call('GetCurrentProgramScene'),
      getVirtualCameraStatus(obs),
    ]);
    const sceneNames = Array.isArray(sceneList.scenes)
      ? sceneList.scenes.map((scene) => scene.sceneName).filter(Boolean)
      : [];
    const scenes = [];

    for (const sceneName of sceneNames) {
      try {
        const sceneItems = await obs.call('GetSceneItemList', { sceneName });
        const sources = Array.isArray(sceneItems.sceneItems)
          ? sceneItems.sceneItems.map((item) => ({
              name: item.sourceName || item.inputName || '',
              type: item.sourceType || item.inputKind || item.sourceKind || '',
              sceneItemId: item.sceneItemId,
              enabled: item.sceneItemEnabled !== false,
              status: item.sceneItemEnabled === false ? '未连接' : '存在',
            }))
          : [];

        scenes.push({ name: sceneName, sources });
      } catch (error) {
        scenes.push({
          name: sceneName,
          sources: [],
          errorMessage: normalizeObsError(error),
        });
      }
    }

    const flatSources = scenes.flatMap((scene) =>
      scene.sources.map((source) => ({
        ...source,
        sceneName: scene.name,
      })),
    );

    return {
      obsStatus: '已连接',
      virtualCameraStatus,
      obsVersion: version.obsVersion || version.obsWebSocketVersion || connected.connectResult.obsWebSocketVersion || 'unknown',
      obsWebSocketVersion: version.obsWebSocketVersion || connected.connectResult.obsWebSocketVersion || 'unknown',
      negotiatedRpcVersion: connected.connectResult.negotiatedRpcVersion,
      currentScene: currentProgramScene.currentProgramSceneName || sceneList.currentProgramSceneName || '',
      scenes,
      sceneSources: flatSources,
      sourceCount: flatSources.length,
      errorMessage: '',
      checkedAt: new Date().toISOString(),
    };
  } finally {
    await disconnectObs(obs);
  }
}

async function sendHeartbeat(config, device) {
  const startedAt = Date.now();
  const obsSnapshot = await getObsStatusSnapshot(config);
  const body = {
    onlineStatus: '在线',
    obsStatus: obsSnapshot.obsStatus,
    virtualCameraStatus: obsSnapshot.virtualCameraStatus,
    cpuUsage: getCpuUsagePercent(),
    memoryUsage: getMemoryUsagePercent(),
    networkLatency: 0,
    version: CLIENT_VERSION,
    timestamp: new Date().toISOString(),
    errorMessage: obsSnapshot.obsStatus === '连接异常' ? obsSnapshot.errorMessage : '',
    level: obsSnapshot.obsStatus === '连接异常' ? 'warning' : 'info',
  };

  const data = await apiRequest(config, `/api/executors/${device.executorId}/heartbeat`, {
    method: 'POST',
    token: device.deviceToken,
    body,
  });

  const latency = Date.now() - startedAt;
  log(
    `Heartbeat sent executorId=${device.executorId}, cpu=${body.cpuUsage}%, mem=${body.memoryUsage}%, obs=${body.obsStatus}, latency=${latency}ms`,
  );

  return data;
}

async function ackCommand(config, device, command, status, resultMessage, detail = null) {
  const data = await apiRequest(config, `/api/executors/commands/${command.id}/ack`, {
    method: 'POST',
    token: device.deviceToken,
    body: {
      status,
      resultMessage,
      detail,
    },
  });

  log(`Command acknowledged commandId=${command.id}, status=${data.command?.status || status}`);
  return data;
}

async function handleObsCommand(config, device, command) {
  if (command.commandType === 'obs_test') {
    const detail = await getObsStatusSnapshot(config);

    if (detail.obsStatus === '已连接') {
      await ackCommand(config, device, command, 'succeeded', `OBS connected: ${detail.currentScene || 'no current scene'}`, detail);
      return;
    }

    await ackCommand(config, device, command, 'failed', `OBS unavailable: ${detail.errorMessage || 'not configured'}`, detail);
    return;
  }

  if (command.commandType === 'refresh_obs_scenes') {
    try {
      const detail = await collectObsScenes(config);
      await ackCommand(
        config,
        device,
        command,
        'succeeded',
        `OBS scenes refreshed: ${detail.scenes?.length || 0} scenes, ${detail.sourceCount || 0} sources`,
        detail,
      );
    } catch (error) {
      const detail = {
        obsStatus: isObsConfigured(config) ? '连接异常' : '未连接',
        virtualCameraStatus: '未连接',
        errorMessage: normalizeObsError(error),
        scenes: [],
        sceneSources: [],
        sourceCount: 0,
        checkedAt: new Date().toISOString(),
      };
      await ackCommand(config, device, command, 'failed', `OBS scene refresh failed: ${detail.errorMessage}`, detail);
    }
  }
}

async function handleSpeakCommand(config, device, command, digitalHumanAdapter) {
  const payload = command.payload || {};
  const text = String(payload.text || '').trim();
  const tone = String(payload.tone || 'natural').trim() || 'natural';
  const source = payload.source || 'command';
  const trace = payload.trace || null;

  if (!text) {
    await ackCommand(config, device, command, 'failed', 'Speak command missing text.', {
      ok: false,
      adapter: config.dhAdapter,
      reason: 'text is required',
      trace,
    });
    return;
  }

  try {
    const receivedAt = new Date().toISOString();
    await ackCommand(config, device, command, 'received', 'Speak command received by local executor.', {
      ok: true,
      adapter: config.dhAdapter,
      commandType: 'speak',
      source,
      receivedAt,
      trace,
    });

    const startedAt = new Date().toISOString();
    await ackCommand(config, device, command, 'running', 'Digital human speak started.', {
      ok: true,
      adapter: config.dhAdapter,
      commandType: 'speak',
      source,
      receivedAt,
      startedAt,
      trace,
    });

    const result = await digitalHumanAdapter.speak({ text, tone, source, trace });
    const finishedAt = new Date().toISOString();
    const detail = {
      ...result,
      commandType: 'speak',
      source,
      receivedAt,
      startedAt: result?.startedAt || startedAt,
      finishedAt,
      trace,
    };

    if (result?.ok) {
      await ackCommand(config, device, command, 'done', result.message || 'Digital human speak completed.', detail);
      return;
    }

    await ackCommand(config, device, command, 'failed', result?.message || 'Digital human speak failed.', detail);
  } catch (error) {
    await ackCommand(config, device, command, 'failed', `Digital human speak failed: ${error.message || 'unknown error'}`, {
      ok: false,
      adapter: config.dhAdapter,
      errorMessage: error.message || 'unknown error',
      commandType: 'speak',
      source,
      trace,
      finishedAt: new Date().toISOString(),
    });
  }
}

async function handleCommand(config, device, command, digitalHumanAdapter) {
  const commandId = command.id || command.commandId;

  if (!commandId) {
    log('Received command without commandId, ignored.');
    return;
  }

  if (device.ackedCommandIds.includes(commandId)) {
    log(`Command already handled locally, re-acking commandId=${commandId}`);
    await ackCommand(config, device, { ...command, id: commandId }, 'succeeded', 'Duplicate command already handled locally.');
    return;
  }

  if (OBS_COMMANDS.has(command.commandType)) {
    log(`Received OBS command commandId=${commandId}, type=${command.commandType}`);
    await handleObsCommand(config, device, { ...command, id: commandId });
    device.ackedCommandIds.push(commandId);
    saveDevice(device);
    return;
  }

  if (DIGITAL_HUMAN_COMMANDS.has(command.commandType)) {
    log(`Received digital human command commandId=${commandId}, type=${command.commandType}`);
    await handleSpeakCommand(config, device, { ...command, id: commandId }, digitalHumanAdapter);
    device.ackedCommandIds.push(commandId);
    saveDevice(device);
    return;
  }

  if (!KNOWN_PRINT_ONLY_COMMANDS.has(command.commandType)) {
    log(`Unsupported command commandId=${commandId}, type=${command.commandType}`);
    await ackCommand(config, device, { ...command, id: commandId }, 'failed', `Unsupported command type: ${command.commandType}`);
    device.ackedCommandIds.push(commandId);
    saveDevice(device);
    return;
  }

  log(`Received command commandId=${commandId}, type=${command.commandType}`);
  log(`MVP print-only command. No real OBS/live platform/digital human action executed. payload=${JSON.stringify(command.payload || {})}`);

  device.ackedCommandIds.push(commandId);
  saveDevice(device);
  await ackCommand(config, device, { ...command, id: commandId }, 'succeeded', 'MVP command printed locally. No real local action executed.');
}

async function pollCommands(config, device, digitalHumanAdapter) {
  const data = await apiRequest(config, `/api/executors/${device.executorId}/commands/pending`, {
    token: device.deviceToken,
  });
  const commands = Array.isArray(data.list) ? data.list : [];

  if (commands.length) {
    log(`Fetched ${commands.length} pending command(s).`);
  }

  for (const command of commands) {
    await handleCommand(config, device, command, digitalHumanAdapter);
  }

  return Number(data.pollingIntervalSeconds || 5);
}

function getBackoffMs(failureCount) {
  const base = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.min(failureCount, 6));
  const jitter = Math.floor(Math.random() * 500);
  return Math.min(MAX_BACKOFF_MS, base + jitter);
}

function explainError(error) {
  if (error.code === 40102 || error.status === 401) {
    return `${error.message}. Device token may be invalid. Delete executor-client/.device.json and register again.`;
  }

  return error.message;
}

async function main() {
  if (typeof fetch !== 'function') {
    throw new Error('Current Node.js version does not support native fetch. Please use Node 18+.');
  }

  const config = loadConfig();
  let device = loadDevice();
  let failureCount = 0;
  let pollingIntervalSeconds = 5;
  let lastHeartbeatAt = 0;
  const digitalHumanAdapter = createDigitalHumanAdapter(config);
  const adapterStatus = await digitalHumanAdapter.init(config);

  log(
    `Executor client started baseUrl=${config.baseUrl}, obsUrl=${config.obsUrl || 'disabled'}, dhAdapter=${config.dhAdapter}, version=${CLIENT_VERSION}`,
  );
  log(`Digital human adapter initialized: ${adapterStatus.message || adapterStatus.adapter || config.dhAdapter}`);

  while (!stopping) {
    try {
      device = await ensureRegistered(config, device);

      if (!device) {
        await sleep(getBackoffMs(failureCount));
        failureCount += 1;
        continue;
      }

      const currentTime = Date.now();

      if (currentTime - lastHeartbeatAt >= config.heartbeatIntervalSeconds * 1000) {
        await sendHeartbeat(config, device);
        lastHeartbeatAt = currentTime;
      }

      pollingIntervalSeconds = await pollCommands(config, device, digitalHumanAdapter);
      failureCount = 0;
      await sleep(Math.max(1000, pollingIntervalSeconds * 1000));
    } catch (error) {
      failureCount += 1;
      const backoffMs = getBackoffMs(failureCount);
      log(`Runtime error: ${explainError(error)}. Retry in ${Math.round(backoffMs / 1000)}s.`);
      await sleep(backoffMs);
    }
  }

  await digitalHumanAdapter.dispose();
}

process.on('SIGINT', () => {
  stopping = true;
  log('Received SIGINT, exiting.');
});

process.on('SIGTERM', () => {
  stopping = true;
  log('Received SIGTERM, exiting.');
});

main().catch((error) => {
  log(`Startup failed: ${error.message}`);
  process.exitCode = 1;
});
