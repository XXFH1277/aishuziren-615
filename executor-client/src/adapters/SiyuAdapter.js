import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, '..', '..');

const DEFAULT_RUNTIME_ROOT = 'F:/AIshuziren/siyuAI_V194/siyuAI_V194';
const DEFAULT_BRIDGE_DIR = path.join(clientRoot, 'runtime', 'siyu-bridge');
const DEFAULT_CONFIG_PATH = 'config/config.yaml';
const DEFAULT_ENTRY_SCRIPT = 'start.py';
const DEFAULT_PYTHON_PATH = 'env/python.exe';
const DEFAULT_EXE_PATH = 'digital-human-live.exe';
const DEFAULT_BRIDGE_SCRIPT = path.join(clientRoot, 'src', 'bridges', 'siyu_local_bridge.py');
const DEFAULT_BRIDGE_POLL_INTERVAL_SECONDS = 0.5;

const REMOTE_ONLY_KEYS = new Set(['server_url', 'token', 'update_url']);

const MODEL_PATH_KEYS = [
  'asr_weight_path',
  'bert_base_path',
  'face_detect_model_dir',
  'image_infer_hubert_path',
  'image_infer_v2_mask_dir',
  'image_infer_v2_silence_path',
  'image_infer_v2_weights_path',
  'lip_detect_weights',
  'unet_base_model',
  'unet_v2_model',
  'vgg_path',
  'voice_infer_hubert_path',
  'voice_infer_v2_weights_path',
  'wenet_config',
  'wenet_model',
  'xseg_model_path',
  'yolo_model_path',
];

const FALLBACK_MODEL_PATHS = {
  asr_weight_path: 'assets/pretrained_models/asr',
  bert_base_path: 'assets/pretrained_models/voice_infer/chinese-roberta-wwm-ext-large',
  face_detect_model_dir: 'assets/pretrained_models/face_detect',
  image_infer_hubert_path: 'assets/pretrained_models/hubert_checkpoints',
  image_infer_v2_mask_dir: 'assets/pretrained_models/image_infer_v2',
  image_infer_v2_silence_path: 'assets/pretrained_models/image_infer_v2/silence.npy',
  image_infer_v2_weights_path: 'assets/pretrained_models/image_infer_v2/unet_v2.onnx',
  lip_detect_weights: 'assets/pretrained_models/lip_detect_weights',
  unet_base_model: 'assets/pretrained_models/unet/v10/checkpoint_e140.pth',
  unet_v2_model: 'assets/pretrained_models/image_infer_v2/unet_v2.onnx',
  vgg_path: 'assets/pretrained_models/vgg/vgg19-dcbb9e9d.pth',
  voice_infer_hubert_path: 'assets/pretrained_models/voice_infer/chinese-hubert-base',
  voice_infer_v2_weights_path: 'assets/pretrained_models/voice_infer_v2',
  wenet_config: 'assets/pretrained_models/wenet/conf/train_conformer_multi_cn.yaml',
  wenet_model: 'assets/pretrained_models/wenet/exp/conformer/wenetmodel.pt',
  xseg_model_path: 'assets/pretrained_models/xseg/dfl_xseg.onnx',
  yolo_model_path: 'assets/pretrained_models/yolov8n-face.pt',
};

function normalizeSlashes(value) {
  return String(value || '').replace(/\\/g, '/');
}

function stripInlineComment(value) {
  const raw = String(value || '').trim();
  const quoted = raw.match(/^['"](.*)['"]$/);

  if (quoted) {
    return quoted[1].trim();
  }

  const commentIndex = raw.indexOf(' #');
  return commentIndex >= 0 ? raw.slice(0, commentIndex).trim() : raw;
}

function readTopLevelYaml(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const values = {};

  for (const line of lines) {
    if (!line || /^\s/.test(line) || line.trim().startsWith('#')) {
      continue;
    }

    const match = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (match) {
      values[match[1]] = stripInlineComment(match[2]);
    }
  }

  return values;
}

function resolveRuntimePath(runtimeRoot, value) {
  const normalized = normalizeSlashes(value);

  if (!normalized) {
    return '';
  }

  if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith('/')) {
    return path.normalize(normalized);
  }

  return path.join(runtimeRoot, normalized);
}

function resolveClientPath(value) {
  const normalized = normalizeSlashes(value);

  if (!normalized) {
    return '';
  }

  if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith('/')) {
    return path.normalize(normalized);
  }

  return path.join(clientRoot, normalized);
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function fileExists(filePath) {
  try {
    return Boolean(filePath && fs.existsSync(filePath));
  } catch {
    return false;
  }
}

function buildCommandId() {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const random = Math.random().toString(16).slice(2, 8);
  return `SIYU-SPEAK-${timestamp}-${random}`;
}

function sanitizeRemoteFields(configValues) {
  return Object.fromEntries(
    Object.entries(configValues)
      .filter(([key]) => REMOTE_ONLY_KEYS.has(key))
      .map(([key, value]) => [key, value ? '[present-but-ignored]' : '']),
  );
}

export class SiyuAdapter {
  constructor(config = {}) {
    this.config = config;
    this.initialized = false;
    this.lastSpeechAt = '';
    this.lastHealth = null;
    this.runtimeProcess = null;
    this.startedRuntime = false;
  }

  get runtimeRoot() {
    return path.normalize(normalizeSlashes(this.config.runtimeRoot || DEFAULT_RUNTIME_ROOT));
  }

  get bridgeDir() {
    return path.normalize(normalizeSlashes(this.config.bridgeDir || DEFAULT_BRIDGE_DIR));
  }

  get configPath() {
    return resolveRuntimePath(this.runtimeRoot, this.config.configPath || DEFAULT_CONFIG_PATH);
  }

  get pythonPath() {
    return resolveRuntimePath(this.runtimeRoot, this.config.pythonPath || DEFAULT_PYTHON_PATH);
  }

  get entryScript() {
    return resolveRuntimePath(this.runtimeRoot, this.config.entryScript || DEFAULT_ENTRY_SCRIPT);
  }

  get exePath() {
    return resolveRuntimePath(this.runtimeRoot, this.config.exePath || DEFAULT_EXE_PATH);
  }

  get bridgeScript() {
    return resolveClientPath(this.config.bridgeScript || DEFAULT_BRIDGE_SCRIPT);
  }

  get bridgePollIntervalSeconds() {
    const configured = Number(this.config.bridgePollIntervalSeconds || DEFAULT_BRIDGE_POLL_INTERVAL_SECONDS);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_BRIDGE_POLL_INTERVAL_SECONDS;
  }

  get launchMode() {
    return String(this.config.launchMode || 'bridge').trim().toLowerCase();
  }

  get autoStart() {
    return this.config.autoStart === true || String(this.config.autoStart || '').toLowerCase() === 'true';
  }

  get requiredModelKeys() {
    if (Array.isArray(this.config.requiredModelKeys) && this.config.requiredModelKeys.length) {
      return this.config.requiredModelKeys;
    }

    return MODEL_PATH_KEYS;
  }

  buildModelManifest(configValues) {
    return this.requiredModelKeys.map((key) => {
      const configuredPath = configValues[key] || FALLBACK_MODEL_PATHS[key] || '';
      const resolvedPath = resolveRuntimePath(this.runtimeRoot, configuredPath);

      return {
        key,
        configuredPath,
        resolvedPath,
        exists: fileExists(resolvedPath),
      };
    });
  }

  validateRuntime() {
    const runtimeExists = fileExists(this.runtimeRoot);
    const configExists = fileExists(this.configPath);
    const configValues = readTopLevelYaml(this.configPath);
    const modelManifest = this.buildModelManifest(configValues);
    const missingModels = modelManifest.filter((item) => !item.exists);
    const pythonExists = fileExists(this.pythonPath);
    const entryExists = fileExists(this.entryScript);
    const exeExists = fileExists(this.exePath);
    const bridgeScriptExists = fileExists(this.bridgeScript);
    const launchTargetOk =
      this.launchMode === 'exe'
        ? exeExists
        : this.launchMode === 'bridge'
          ? pythonExists && bridgeScriptExists
          : pythonExists && entryExists;
    const ok = runtimeExists && configExists && missingModels.length === 0 && (!this.autoStart || launchTargetOk);

    return {
      ok,
      adapter: 'siyu',
      mode: 'local_process_bridge',
      runtimeRoot: this.runtimeRoot,
      configPath: this.configPath,
      bridgeDir: this.bridgeDir,
      launchMode: this.launchMode,
      autoStart: this.autoStart,
      runtimeExists,
      configExists,
      pythonPath: this.pythonPath,
      pythonExists,
      entryScript: this.entryScript,
      entryExists,
      bridgeScript: this.bridgeScript,
      bridgeScriptExists,
      bridgePollIntervalSeconds: this.bridgePollIntervalSeconds,
      exePath: this.exePath,
      exeExists,
      launchTargetOk,
      modelCount: modelManifest.length,
      missingModels: missingModels.map((item) => ({ key: item.key, path: item.resolvedPath })),
      remoteFields: sanitizeRemoteFields(configValues),
    };
  }

  startRuntimeProcess() {
    if (!this.autoStart) {
      return {
        started: false,
        message: 'autoStart is disabled; local siyuAI runtime will not be launched by executor-client.',
      };
    }

    if (this.runtimeProcess && !this.runtimeProcess.killed) {
      return {
        started: false,
        pid: this.runtimeProcess.pid,
        message: 'siyuAI runtime process is already tracked by this adapter.',
      };
    }

    let command = this.pythonPath;
    let args = [this.entryScript];

    if (this.launchMode === 'exe') {
      command = this.exePath;
      args = [];
    } else if (this.launchMode === 'bridge') {
      args = [
        this.bridgeScript,
        '--runtime-root',
        this.runtimeRoot,
        '--bridge-dir',
        this.bridgeDir,
        '--poll-interval',
        String(this.bridgePollIntervalSeconds),
      ];
    }

    this.runtimeProcess = spawn(command, args, {
      cwd: this.runtimeRoot,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    this.runtimeProcess.unref();
    this.startedRuntime = true;

    return {
      started: true,
      pid: this.runtimeProcess.pid,
      command,
      args,
      message:
        this.launchMode === 'bridge'
          ? 'siyuAI local bridge consumer launched.'
          : 'siyuAI local runtime process launched.',
    };
  }

  async init() {
    this.initialized = true;
    const validation = this.validateRuntime();
    let launch = null;

    if (validation.ok && this.autoStart) {
      try {
        launch = this.startRuntimeProcess();
      } catch (error) {
        validation.ok = false;
        validation.launchError = error.message || 'failed to launch siyuAI runtime';
      }
    }

    this.lastHealth = {
      ...validation,
      launch,
      checkedAt: new Date().toISOString(),
    };

    return {
      ...this.lastHealth,
      message: validation.ok
        ? 'siyuAI local runtime configuration is ready. Speak commands will be written to the local bridge queue.'
        : 'siyuAI local runtime configuration is incomplete. Check runtimeRoot, configPath, Python/EXE, and model paths.',
    };
  }

  async speak({ text, tone = 'natural', source = 'command', trace = null } = {}) {
    const startedAt = new Date().toISOString();
    const normalizedText = String(text || '').trim();

    if (!normalizedText) {
      return {
        ok: false,
        startedAt,
        durationMs: 0,
        adapter: 'siyu',
        mode: 'local_process_bridge',
        message: 'Speak text is empty.',
      };
    }

    const validation = this.validateRuntime();

    if (!validation.ok) {
      return {
        ok: false,
        startedAt,
        durationMs: 0,
        adapter: 'siyu',
        mode: 'local_process_bridge',
        message: 'siyuAI local runtime is not ready; speak command was not queued.',
        validation,
      };
    }

    const start = Date.now();
    const commandId = buildCommandId();
    const commandsDir = path.join(this.bridgeDir, 'commands');
    const acceptedDir = path.join(this.bridgeDir, 'accepted');
    ensureDirectory(commandsDir);
    ensureDirectory(acceptedDir);

    const bridgePayload = {
      id: commandId,
      type: 'speak',
      status: 'queued',
      text: normalizedText,
      tone,
      source,
      trace,
      createdAt: startedAt,
      runtime: {
        root: this.runtimeRoot,
        configPath: this.configPath,
        launchMode: this.launchMode,
      },
      output: {
        expected: 'siyuAI runtime should consume this command and render via local OBS/SRS pipeline.',
      },
    };
    const commandPath = path.join(commandsDir, `${commandId}.json`);
    const latestPath = path.join(this.bridgeDir, 'latest-speak.json');
    fs.writeFileSync(commandPath, `${JSON.stringify(bridgePayload, null, 2)}\n`, 'utf8');
    fs.writeFileSync(latestPath, `${JSON.stringify(bridgePayload, null, 2)}\n`, 'utf8');
    fs.writeFileSync(
      path.join(acceptedDir, `${commandId}.json`),
      `${JSON.stringify({ ...bridgePayload, acceptedAt: new Date().toISOString() }, null, 2)}\n`,
      'utf8',
    );

    this.lastSpeechAt = startedAt;

    return {
      ok: true,
      startedAt,
      durationMs: Date.now() - start,
      adapter: 'siyu',
      mode: 'local_process_bridge',
      bridgeStatus: 'queued',
      commandId,
      commandPath,
      latestPath,
      message: 'siyuAI speak command queued to local bridge. No remote API was called.',
      tone,
      textLength: normalizedText.length,
    };
  }

  async getStatus() {
    if (!this.initialized) {
      return {
        ok: false,
        adapter: 'siyu',
        initialized: false,
        message: 'siyuAI adapter not initialized.',
      };
    }

    const validation = this.validateRuntime();
    this.lastHealth = {
      ...validation,
      initialized: true,
      lastSpeechAt: this.lastSpeechAt,
      runtimeProcess: this.runtimeProcess
        ? {
            pid: this.runtimeProcess.pid,
            startedByAdapter: this.startedRuntime,
            killed: this.runtimeProcess.killed,
          }
        : null,
      checkedAt: new Date().toISOString(),
    };

    return this.lastHealth;
  }

  async dispose() {
    if (this.runtimeProcess && this.startedRuntime && !this.runtimeProcess.killed) {
      try {
        this.runtimeProcess.kill();
      } catch {
        // Ignore shutdown failures for detached local runtime.
      }
    }

    this.initialized = false;
    this.runtimeProcess = null;
  }
}
