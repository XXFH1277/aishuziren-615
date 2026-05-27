import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..');
const dataDir = path.join(serverRoot, 'data');
const schemaPath = path.join(__dirname, 'schema.sql');
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
  'comments',
  'questions',
  'manual_takeover_state',
  'users',
  'roles',
  'operation_logs',
  'tickets',
  'executors',
  'executor_commands',
]);

fs.mkdirSync(dataDir, { recursive: true });

export const dbPath = path.join(dataDir, 'dev.sqlite');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

export function runSchema() {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
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
