import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { db, now, runSchema } from '../server/db/database.js';
import { hashDeviceToken } from '../server/utils/deviceAuth.js';
import { verifyPassword } from '../server/utils/password.js';

const __filename = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(__filename);
const projectRoot = path.resolve(scriptDir, '..');
const devicePath = path.join(projectRoot, 'executor-client', '.device.json');

const ADMIN_USERNAME = 'admin';
const DEMO_TASK_ID = 'LT001';
const STALE_COMMAND_MS = 2 * 60 * 1000;
const FRESH_HEARTBEAT_MS = 30 * 1000;

const STATUS_ENABLED = '\u542f\u7528';
const STATUS_PENDING_SEND = '\u5f85\u4e0b\u53d1';
const STATUS_SENDING = '\u4e0b\u53d1\u4e2d';
const STATUS_CANCELLED = 'cancelled';

const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith('--')) || 'health';
const flags = new Set(args.filter((arg) => arg.startsWith('--')));
const jsonOutput = flags.has('--json');
const adminPassword = process.env.DEMO_ADMIN_PASSWORD || '';

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function isRecentTimestamp(value, thresholdMs) {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return false;
  }

  return Date.now() - timestamp <= thresholdMs;
}

function getLocalDevice() {
  const device = readJsonFile(devicePath);

  if (!device?.executorId || !device?.deviceToken) {
    return {
      device: null,
      executor: null,
      tokenMatches: false,
    };
  }

  const executor = db.prepare('SELECT * FROM executors WHERE id = ? LIMIT 1').get(device.executorId);
  const tokenMatches = Boolean(executor?.device_token_hash && executor.device_token_hash === hashDeviceToken(device.deviceToken));

  return {
    device,
    executor,
    tokenMatches,
  };
}

function ensureLocalExecutorBinding() {
  const { device, executor, tokenMatches } = getLocalDevice();

  if (!device || !executor || !tokenMatches) {
    throw new Error('Local executor device file is missing or invalid. Start from an already registered executor-client/.device.json.');
  }

  const task = db.prepare('SELECT * FROM live_tasks WHERE id = ? LIMIT 1').get(DEMO_TASK_ID);

  if (!task) {
    throw new Error(`Demo live task ${DEMO_TASK_ID} is missing. Run npm run server:seed first.`);
  }

  db.prepare(
    `UPDATE live_tasks
     SET executor_id = @executorId,
         executor_name = @executorName,
         updated_at = @updatedAt
     WHERE id = @taskId`,
  ).run({
    taskId: DEMO_TASK_ID,
    executorId: executor.id,
    executorName: executor.name || executor.device_name || executor.id,
    updatedAt: now(),
  });

  return db.prepare('SELECT id, task_name, executor_id, executor_name FROM live_tasks WHERE id = ?').get(DEMO_TASK_ID);
}

function repairStaleCommands(activeExecutorId) {
  const timestamp = now();
  const cutoff = Date.now() - STALE_COMMAND_MS;
  const rows = db
    .prepare("SELECT id, executor_id, created_at FROM executor_commands WHERE status IN ('pending', 'received', 'running')")
    .all();
  const staleRows = rows.filter((row) => {
    const createdAt = Date.parse(row.created_at || '');
    const isOld = Number.isNaN(createdAt) || createdAt < cutoff;
    return row.executor_id !== activeExecutorId || isOld;
  });

  const cancelCommand = db.prepare(
    `UPDATE executor_commands
     SET status = @status,
         result_message = @resultMessage,
         ack_payload_json = @ackPayload,
         acked_at = @ackedAt,
         updated_at = @updatedAt
     WHERE id = @id`,
  );
  const resetSpeech = db.prepare(
    `UPDATE speech_queue
     SET broadcast_status = @broadcastStatus,
         executor_command_id = '',
         broadcast_result_json = '',
         broadcast_error_message = '',
         broadcast_started_at = '',
         broadcast_finished_at = '',
         updated_at = @updatedAt
     WHERE executor_command_id = @commandId
       AND broadcast_status = @sendingStatus`,
  );

  for (const commandRow of staleRows) {
    cancelCommand.run({
      id: commandRow.id,
      status: STATUS_CANCELLED,
      resultMessage: 'Cancelled by local demo repair before startup.',
      ackPayload: JSON.stringify({
        ok: false,
        source: 'local_demo_repair',
        message: 'Cancelled stale local demo command.',
        finishedAt: timestamp,
      }),
      ackedAt: timestamp,
      updatedAt: timestamp,
    });
    resetSpeech.run({
      commandId: commandRow.id,
      broadcastStatus: STATUS_PENDING_SEND,
      sendingStatus: STATUS_SENDING,
      updatedAt: timestamp,
    });
  }

  return staleRows.map((row) => row.id);
}

function repairDemo() {
  runSchema();

  const result = db.transaction(() => {
    const { executor } = getLocalDevice();
    const task = ensureLocalExecutorBinding();
    const cancelledCommandIds = repairStaleCommands(executor.id);

    return {
      executor: {
        id: executor.id,
        name: executor.name || executor.device_name || executor.id,
        status: executor.status,
        lastHeartbeatAt: executor.last_heartbeat_at,
        heartbeatFresh: isRecentTimestamp(executor.last_heartbeat_at, FRESH_HEARTBEAT_MS),
      },
      task,
      cancelledCommandIds,
      deviceFile: path.relative(projectRoot, devicePath),
    };
  })();

  return {
    ok: true,
    repairedAt: now(),
    ...result,
  };
}

function check(condition, name, okDetail, failDetail, level = 'fail') {
  return {
    name,
    status: condition ? 'ok' : level,
    detail: condition ? okDetail : failDetail,
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      text,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      text: error?.message || 'request failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function healthCheck() {
  runSchema();

  const checks = [];
  const admin = db.prepare('SELECT * FROM users WHERE username = ? LIMIT 1').get(ADMIN_USERNAME);
  const { device, executor, tokenMatches } = getLocalDevice();
  const task = db.prepare('SELECT * FROM live_tasks WHERE id = ? LIMIT 1').get(DEMO_TASK_ID);
  const pendingCount = db
    .prepare("SELECT COUNT(*) AS count FROM executor_commands WHERE status IN ('pending', 'received', 'running')")
    .get().count;

  checks.push(check(Boolean(admin), 'admin.exists', 'admin row exists', 'admin row is missing'));
  checks.push(
    check(
      admin?.status === STATUS_ENABLED,
      'admin.enabled',
      'admin status is active',
      `admin status is ${admin?.status || 'missing'}`,
      'warn',
    ),
  );
  checks.push(
    adminPassword
      ? check(
          Boolean(admin?.password_hash && verifyPassword(adminPassword, admin.password_hash)),
          'admin.password',
          'provided demo password verifies locally',
          'provided demo password does not verify locally',
        )
      : check(false, 'admin.password', '', 'set DEMO_ADMIN_PASSWORD to verify login password', 'warn'),
  );
  checks.push(check(Boolean(device?.executorId), 'device.file', 'local device file exists', 'executor-client/.device.json is missing'));
  checks.push(
    check(
      Boolean(executor),
      'executor.exists',
      `executor ${executor?.id || ''} exists`,
      'local device executor is missing from database',
    ),
  );
  checks.push(
    check(
      tokenMatches,
      'executor.token',
      'local device token matches database hash',
      'local device token does not match database hash',
    ),
  );
  checks.push(
    check(
      isRecentTimestamp(executor?.last_heartbeat_at, FRESH_HEARTBEAT_MS),
      'executor.heartbeat',
      `fresh heartbeat at ${executor?.last_heartbeat_at}`,
      `no fresh heartbeat; last=${executor?.last_heartbeat_at || 'none'}`,
      'warn',
    ),
  );
  checks.push(
    check(
      task?.executor_id === executor?.id,
      'task.binding',
      `${DEMO_TASK_ID} is bound to ${executor?.id}`,
      `${DEMO_TASK_ID} is bound to ${task?.executor_id || 'none'}, expected ${executor?.id || 'local executor'}`,
    ),
  );
  checks.push(
    check(
      Number(pendingCount) === 0,
      'commands.pending',
      'no pending/running commands in database',
      `${pendingCount} pending/running command(s) remain`,
      'warn',
    ),
  );

  const apiHealth = await fetchWithTimeout('http://localhost:3000/api/health');
  checks.push(check(apiHealth.ok, 'api.health', `HTTP ${apiHealth.status}`, apiHealth.text || 'API is not reachable'));

  const frontendHealth = await fetchWithTimeout('http://127.0.0.1:5173/');
  checks.push(
    check(
      frontendHealth.ok,
      'frontend.health',
      `HTTP ${frontendHealth.status}`,
      frontendHealth.text || 'frontend is not reachable',
      'warn',
    ),
  );

  if (apiHealth.ok && adminPassword) {
    const login = await fetchWithTimeout(
      'http://localhost:3000/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: ADMIN_USERNAME, password: adminPassword }),
      },
      5000,
    );

    let loginPayload = null;
    try {
      loginPayload = JSON.parse(login.text);
    } catch {
      loginPayload = null;
    }

    checks.push(
      check(
        login.ok && loginPayload?.code === 0 && Boolean(loginPayload?.data?.token),
        'api.login',
        'admin login returns bearer token',
        loginPayload?.message || login.text || 'admin login failed',
      ),
    );
  }

  const failCount = checks.filter((item) => item.status === 'fail').length;
  const warnCount = checks.filter((item) => item.status === 'warn').length;

  return {
    ok: failCount === 0,
    checkedAt: now(),
    failCount,
    warnCount,
    executor: executor
      ? {
          id: executor.id,
          name: executor.name || executor.device_name || executor.id,
          status: executor.status,
          lastHeartbeatAt: executor.last_heartbeat_at,
        }
      : null,
    task: task
      ? {
          id: task.id,
          taskName: task.task_name,
          executorId: task.executor_id,
          executorName: task.executor_name,
        }
      : null,
    checks,
  };
}

function printHuman(result) {
  if (command === 'repair') {
    console.log(`[local-demo] repaired at ${result.repairedAt}`);
    console.log(`[local-demo] executor=${result.executor.id} (${result.executor.name}), heartbeatFresh=${result.executor.heartbeatFresh}`);
    console.log(`[local-demo] task=${result.task.id}, executor=${result.task.executor_id} (${result.task.executor_name})`);
    console.log(`[local-demo] cancelledStaleCommands=${result.cancelledCommandIds.join(',') || 'none'}`);
    console.log(`[local-demo] deviceFile=${result.deviceFile}`);
    return;
  }

  console.log(`[local-demo] health checked at ${result.checkedAt}`);
  for (const item of result.checks) {
    const label = item.status.toUpperCase().padEnd(4, ' ');
    console.log(`[${label}] ${item.name}: ${item.detail}`);
  }
  console.log(`[local-demo] result=${result.ok ? 'OK' : 'FAILED'}, warnings=${result.warnCount}, failures=${result.failCount}`);
}

try {
  const result = command === 'repair' ? repairDemo() : await healthCheck();

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHuman(result);
  }

  process.exitCode = result.ok ? 0 : 1;
} catch (error) {
  const payload = {
    ok: false,
    command,
    error: error?.message || String(error),
  };

  if (jsonOutput) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.error(`[local-demo] ${payload.error}`);
  }

  process.exitCode = 1;
}
