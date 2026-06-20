import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..');
const dataDir = path.join(serverRoot, 'data');
const schemaPath = path.join(__dirname, 'schema.sql');
const oldLiveTalkingObsUrl = 'http://127.0.0.1:8010/index.html';
const defaultObsOutputUrl = process.env.OBS_BROWSER_SOURCE_URL || 'http://127.0.0.1:5173/obs/output';
const defaultObsPreviewStreamUrl =
  process.env.OBS_PREVIEW_STREAM_URL ||
  'http://127.0.0.1:8080/players/srs_player.html?autostart=true&schema=http&host=127.0.0.1&port=8080&app=live&stream=dh';
const defaultObsPreviewIngestUrl = process.env.OBS_PREVIEW_INGEST_URL || 'rtmp://127.0.0.1/live/dh';
const allowedIdTables = new Set([
  'products',
  'product_groups',
  'avatars',
  'avatar_actions',
  'live_rooms',
  'live_tasks',
  'studio_backgrounds',
  'delay_control_state',
  'speech_queue',
  'subtitle_settings',
  'delay_settings',
  'ai_model_providers',
  'ai_model_credentials',
  'ai_model_role_settings',
  'prompt_templates',
  'ai_call_logs',
  'ai_cost_daily',
  'compliance_keywords',
  'compliance_check_logs',
  'comments',
  'questions',
  'manual_takeover_state',
  'users',
  'roles',
  'auth_sessions',
  'operation_logs',
  'tickets',
  'ticket_attachments',
  'executor_bind_codes',
  'executor_heartbeats',
  'executors',
  'executor_commands',
  'file_assets',
  'live_sessions',
  'talking_video_jobs',
]);

fs.mkdirSync(dataDir, { recursive: true });

export const dbPath = path.join(dataDir, 'dev.sqlite');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

export function runSchema() {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
  ensureAuthColumns();
  ensureAiColumns();
  ensureExecutorColumns();
  ensureObsLocalConfigColumns();
  ensureSpeechQueueColumns();
  ensureScriptLoopStateColumns();
  ensureTalkingVideoJobColumns();
}

function ensureColumn(tableName, columnName, columnDefinition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = columns.some((column) => column.name === columnName);

  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
  }
}

function ensureAuthColumns() {
  ensureColumn('users', 'password_hash', 'password_hash TEXT');
  ensureColumn('users', 'must_change_password', 'must_change_password INTEGER DEFAULT 0');
  ensureColumn('roles', 'permission_keys', 'permission_keys TEXT');
}

function ensureAiColumns() {
  ensureColumn('ai_call_logs', 'error_type', 'error_type TEXT');
  ensureColumn('ai_model_credentials', 'api_key_cipher', 'api_key_cipher TEXT');
  ensureColumn('ai_model_credentials', 'api_key_iv', 'api_key_iv TEXT');
  ensureColumn('ai_model_credentials', 'api_key_tag', 'api_key_tag TEXT');
}

function ensureExecutorColumns() {
  ensureColumn('executors', 'device_token_hash', 'device_token_hash TEXT');
  ensureColumn('executors', 'registered_at', 'registered_at TEXT');
  ensureColumn('executor_heartbeats', 'reported_at', 'reported_at TEXT');
  ensureColumn('executor_heartbeats', 'version', 'version TEXT');
  ensureColumn('executor_commands', 'idempotency_key', 'idempotency_key TEXT');
  ensureColumn('executor_commands', 'timeout_at', 'timeout_at TEXT');
  ensureColumn('executor_commands', 'retry_count', 'retry_count INTEGER DEFAULT 0');
  ensureColumn('executor_commands', 'ack_payload_json', 'ack_payload_json TEXT');
  ensureColumn('executor_commands', 'acked_at', 'acked_at TEXT');
  ensureColumn('executor_commands', 'updated_at', 'updated_at TEXT');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_executors_device_token_hash ON executors(device_token_hash);
    CREATE INDEX IF NOT EXISTS idx_executor_commands_timeout_at ON executor_commands(timeout_at);
  `);
}

function ensureObsLocalConfigColumns() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS obs_local_config (
      id TEXT PRIMARY KEY,
      obs_url TEXT,
      password_cipher TEXT,
      password_iv TEXT,
      password_tag TEXT,
      password_masked TEXT,
      obs_timeout_ms INTEGER DEFAULT 5000,
      scene_name TEXT,
      browser_source_name TEXT,
      browser_source_url TEXT,
      browser_source_width INTEGER DEFAULT 1080,
      browser_source_height INTEGER DEFAULT 1920,
      preview_stream_enabled INTEGER DEFAULT 1,
      preview_stream_type TEXT DEFAULT 'iframe',
      preview_stream_url TEXT,
      preview_ingest_url TEXT,
      last_status_json TEXT,
      updated_at TEXT
    );
  `);
  ensureColumn('obs_local_config', 'password_masked', 'password_masked TEXT');
  ensureColumn('obs_local_config', 'obs_timeout_ms', 'obs_timeout_ms INTEGER DEFAULT 5000');
  ensureColumn('obs_local_config', 'scene_name', 'scene_name TEXT');
  ensureColumn('obs_local_config', 'browser_source_name', 'browser_source_name TEXT');
  ensureColumn('obs_local_config', 'browser_source_url', 'browser_source_url TEXT');
  ensureColumn('obs_local_config', 'browser_source_width', 'browser_source_width INTEGER DEFAULT 1080');
  ensureColumn('obs_local_config', 'browser_source_height', 'browser_source_height INTEGER DEFAULT 1920');
  ensureColumn('obs_local_config', 'preview_stream_enabled', 'preview_stream_enabled INTEGER DEFAULT 1');
  ensureColumn('obs_local_config', 'preview_stream_type', "preview_stream_type TEXT DEFAULT 'iframe'");
  ensureColumn('obs_local_config', 'preview_stream_url', 'preview_stream_url TEXT');
  ensureColumn('obs_local_config', 'preview_ingest_url', 'preview_ingest_url TEXT');
  ensureColumn('obs_local_config', 'output_runtime_session_id', 'output_runtime_session_id TEXT');
  ensureColumn('obs_local_config', 'output_runtime_live_session_id', 'output_runtime_live_session_id TEXT');
  ensureColumn('obs_local_config', 'output_runtime_avatar_id', 'output_runtime_avatar_id TEXT');
  ensureColumn('obs_local_config', 'output_runtime_status', 'output_runtime_status TEXT');
  ensureColumn('obs_local_config', 'output_runtime_updated_at', 'output_runtime_updated_at TEXT');
  ensureColumn('obs_local_config', 'last_status_json', 'last_status_json TEXT');
  db.prepare(
    `UPDATE obs_local_config
     SET browser_source_url = ?
     WHERE browser_source_url = ? OR browser_source_url IS NULL OR browser_source_url = ''`,
  ).run(defaultObsOutputUrl, oldLiveTalkingObsUrl);
  db.prepare(
    `UPDATE obs_local_config
     SET preview_stream_url = ?
     WHERE preview_stream_url IS NULL OR preview_stream_url = ''`,
  ).run(defaultObsPreviewStreamUrl);
  db.prepare(
    `UPDATE obs_local_config
     SET preview_ingest_url = ?
     WHERE preview_ingest_url IS NULL OR preview_ingest_url = ''`,
  ).run(defaultObsPreviewIngestUrl);
}

function ensureSpeechQueueColumns() {
  ensureColumn('speech_queue', 'broadcast_status', 'broadcast_status TEXT');
  ensureColumn('speech_queue', 'executor_command_id', 'executor_command_id TEXT');
  ensureColumn('speech_queue', 'broadcast_result_json', 'broadcast_result_json TEXT');
  ensureColumn('speech_queue', 'broadcast_error_message', 'broadcast_error_message TEXT');
  ensureColumn('speech_queue', 'broadcast_started_at', 'broadcast_started_at TEXT');
  ensureColumn('speech_queue', 'broadcast_finished_at', 'broadcast_finished_at TEXT');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_speech_queue_broadcast_status ON speech_queue(broadcast_status);
    CREATE INDEX IF NOT EXISTS idx_speech_queue_executor_command_id ON speech_queue(executor_command_id);
  `);
}

function ensureScriptLoopStateColumns() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS live_script_loop_state (
      id TEXT PRIMARY KEY,
      live_task_id TEXT UNIQUE,
      live_room_id TEXT,
      status TEXT DEFAULT 'stopped',
      mode TEXT DEFAULT 'template',
      min_queue_size INTEGER DEFAULT 3,
      batch_size INTEGER DEFAULT 5,
      cursor_index INTEGER DEFAULT 0,
      auto_dispatch INTEGER DEFAULT 0,
      settings_json TEXT,
      last_fill_at TEXT,
      last_tick_at TEXT,
      created_at TEXT,
      updated_at TEXT
    );
  `);
  ensureColumn('live_script_loop_state', 'live_room_id', 'live_room_id TEXT');
  ensureColumn('live_script_loop_state', 'status', "status TEXT DEFAULT 'stopped'");
  ensureColumn('live_script_loop_state', 'mode', "mode TEXT DEFAULT 'template'");
  ensureColumn('live_script_loop_state', 'min_queue_size', 'min_queue_size INTEGER DEFAULT 3');
  ensureColumn('live_script_loop_state', 'batch_size', 'batch_size INTEGER DEFAULT 5');
  ensureColumn('live_script_loop_state', 'cursor_index', 'cursor_index INTEGER DEFAULT 0');
  ensureColumn('live_script_loop_state', 'auto_dispatch', 'auto_dispatch INTEGER DEFAULT 0');
  ensureColumn('live_script_loop_state', 'settings_json', 'settings_json TEXT');
  ensureColumn('live_script_loop_state', 'last_fill_at', 'last_fill_at TEXT');
  ensureColumn('live_script_loop_state', 'last_tick_at', 'last_tick_at TEXT');
  ensureColumn('live_script_loop_state', 'created_at', 'created_at TEXT');
  ensureColumn('live_script_loop_state', 'updated_at', 'updated_at TEXT');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_live_script_loop_state_task ON live_script_loop_state(live_task_id);
    CREATE INDEX IF NOT EXISTS idx_live_script_loop_state_status ON live_script_loop_state(status);
  `);
}

function ensureTalkingVideoJobColumns() {
  ensureColumn('talking_video_jobs', 'output_file_id', 'output_file_id TEXT');
  ensureColumn('talking_video_jobs', 'output_file_name', 'output_file_name TEXT');
  ensureColumn('talking_video_jobs', 'output_video_url', 'output_video_url TEXT');
  ensureColumn('talking_video_jobs', 'output_local_path', 'output_local_path TEXT');
  ensureColumn('talking_video_jobs', 'mime_type', 'mime_type TEXT');
  ensureColumn('talking_video_jobs', 'file_size', 'file_size INTEGER DEFAULT 0');
  ensureColumn('talking_video_jobs', 'engine_snapshot_json', 'engine_snapshot_json TEXT');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_talking_video_jobs_status ON talking_video_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_talking_video_jobs_avatar_id ON talking_video_jobs(avatar_id);
    CREATE INDEX IF NOT EXISTS idx_talking_video_jobs_created_at ON talking_video_jobs(created_at);
  `);
}

export function now() {
  return new Date().toISOString();
}

export function toJson(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
}

export function fromJson(value, fallback = null) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function nextId(tableName, prefix) {
  if (!allowedIdTables.has(tableName)) {
    throw new Error(`Unsupported table for id generation: ${tableName}`);
  }

  const rows = db.prepare(`SELECT id FROM ${tableName}`).all();
  const maxNumber = rows.reduce((max, row) => {
    if (!row.id || !row.id.startsWith(prefix)) {
      return max;
    }

    const numericPart = Number.parseInt(row.id.slice(prefix.length), 10);
    return Number.isNaN(numericPart) ? max : Math.max(max, numericPart);
  }, 0);

  return `${prefix}${String(maxNumber + 1).padStart(3, '0')}`;
}
