import express from 'express';
import { db, fromJson, nextId, now, toJson } from '../db/database.js';
import { requirePermission } from '../utils/auth.js';
import {
  buildComplianceErrorDetail,
  buildComplianceRiskTips,
  checkComplianceText,
  isComplianceBlockingResult,
  recordComplianceCheck,
} from '../utils/compliance.js';
import { NOT_FOUND, PARAM_ERROR } from '../utils/errorCodes.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { fail, success } from '../utils/response.js';

const router = express.Router();
const STATUS_APPROVED = '\u5df2\u901a\u8fc7';
const STATUS_REVIEWED = '\u5df2\u5ba1\u6838';
const STATUS_SOON = '\u5373\u5c06\u64ad\u51fa';
const STATUS_PENDING_DISPATCH = '\u5f85\u4e0b\u53d1';
const STATUS_DISPATCHING = '\u4e0b\u53d1\u4e2d';
const STATUS_FAILED = '\u5931\u8d25';
const SOURCE_SCRIPT_LOOP = 'script_loop';
const LOOP_STATUS_RUNNING = 'running';
const LOOP_STATUS_PAUSED = 'paused';
const LOOP_STATUS_STOPPED = 'stopped';
const LOOP_MODE_TEMPLATE = 'template';
const LOOP_MODE_AI = 'ai_assisted';
const onlineExecutorStatuses = ['在线', '直播中', '更新中'];

function firstTask(taskId) {
  if (taskId) {
    return db.prepare('SELECT * FROM live_tasks WHERE id = ?').get(taskId);
  }

  return (
    db.prepare("SELECT * FROM live_tasks WHERE status = '直播中' ORDER BY updated_at DESC, id DESC LIMIT 1").get() ||
    db
      .prepare(
        `SELECT * FROM live_tasks
         WHERE id = (SELECT live_task_id FROM delay_control_state ORDER BY updated_at DESC LIMIT 1)
         LIMIT 1`,
      )
      .get() || db.prepare('SELECT * FROM live_tasks ORDER BY scheduled_start_time DESC, id ASC LIMIT 1').get()
  );
}

function mapTask(row) {
  if (!row) return null;

  return {
    id: row.id,
    taskName: row.task_name,
    liveRoomId: row.live_room_id,
    liveRoomName: row.live_room_name,
    platform: row.platform,
    executorId: row.executor_id,
    executorName: row.executor_name,
    avatarId: row.avatar_id,
    avatarName: row.avatar_name,
    productGroupId: row.product_group_id,
    productGroupName: row.product_group_name,
    scheduledStartTime: row.scheduled_start_time,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRoom(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    theme: row.theme,
    platform: row.platform,
    platformAccount: row.platform_account,
    avatarId: row.avatar_id,
    avatarName: row.avatar_name,
    productGroupId: row.product_group_id,
    productGroupName: row.product_group_name,
    sceneName: row.scene_name,
    layoutType: row.layout_type,
    status: row.status,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

function mapOutput(row) {
  if (!row) return null;

  return {
    id: row.id,
    obsStatus: row.obs_status,
    virtualCameraStatus: row.virtual_camera_status,
    windowCaptureStatus: row.window_capture_status,
    obsVersion: row.obs_version,
    currentScene: row.current_scene,
    currentSource: row.current_source,
    resolution: row.resolution,
    fps: Number(row.fps || 0),
    lastHeartbeatAt: row.last_heartbeat_at,
    sceneMappings: fromJson(row.scene_mappings_json, []),
    checklist: fromJson(row.checklist_json, []),
    updatedAt: row.updated_at,
  };
}

function mapComment(row) {
  return {
    id: row.id,
    liveTaskId: row.live_task_id,
    liveRoomId: row.live_room_id,
    nickname: row.user_nickname,
    content: row.content,
    platform: row.platform,
    time: row.comment_time,
    type: row.recognized_type,
    riskLevel: row.risk_level,
    replyStatus: row.reply_status,
    handledStatus: row.handled_status,
    productId: row.product_id,
    productName: row.product_name,
    createdAt: row.created_at,
  };
}

function mapQuestion(row) {
  return {
    id: row.id,
    liveTaskId: row.live_task_id,
    liveRoomId: row.live_room_id,
    commentId: row.comment_id,
    question: row.question,
    nickname: row.nickname,
    type: row.type,
    productId: row.product_id,
    productName: row.product_name,
    relatedProduct: row.product_name,
    riskLevel: row.risk_level,
    aiReply: row.ai_reply,
    editedReply: row.edited_reply,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDelay(row) {
  if (!row) return null;

  return {
    id: row.id,
    liveTaskId: row.live_task_id,
    liveRoomId: row.live_room_id,
    currentAvatarId: row.current_avatar_id,
    currentAvatar: row.current_avatar_name,
    currentProductGroupId: row.current_product_group_id,
    currentProductGroup: row.current_product_group_name,
    delayMode: row.delay_mode,
    executorStatus: row.executor_status,
    currentSpeech: fromJson(row.current_speech_json, {}),
    nextSpeech: fromJson(row.next_speech_json, {}),
    upcomingSpeech: fromJson(row.upcoming_speech_json, []),
    riskSummary: fromJson(row.risk_summary_json, {}),
    updatedAt: row.updated_at,
  };
}

function mapSpeech(row, order = 0) {
  return {
    id: row.id,
    order,
    liveTaskId: row.live_task_id,
    liveRoomId: row.live_room_id,
    questionId: row.question_id,
    commentId: row.comment_id,
    productId: row.product_id,
    productName: row.product_name,
    relatedProduct: row.product_name,
    text: row.text,
    source: row.source,
    action: row.action,
    tone: row.tone,
    riskLevel: row.risk_level,
    reviewStatus: row.review_status,
    broadcastStatus: row.broadcast_status || '',
    executorCommandId: row.executor_command_id || '',
    broadcastResult: fromJson(row.broadcast_result_json, null),
    broadcastErrorMessage: row.broadcast_error_message || '',
    broadcastStartedAt: row.broadcast_started_at || '',
    broadcastFinishedAt: row.broadcast_finished_at || '',
    scheduledTime: row.scheduled_time,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSubtitles(row) {
  if (!row) return null;

  return {
    id: row.id,
    liveTaskId: row.live_task_id,
    currentSubtitle: fromJson(row.current_subtitle, {}),
    nextSubtitle: fromJson(row.next_subtitle, {}),
    upcomingSubtitles: fromJson(row.upcoming_subtitles_json, []),
    subtitleStyle: fromJson(row.subtitle_style_json, {}),
    updatedAt: row.updated_at,
  };
}

function mapDelaySettings(row) {
  if (!row) return null;

  return {
    id: row.id,
    delayMode: row.delay_mode,
    delaySeconds: row.delay_seconds,
    reviewRules: fromJson(row.review_rules_json, {}),
    queueRules: fromJson(row.queue_rules_json, {}),
    riskRules: fromJson(row.risk_rules_json, []),
    updatedAt: row.updated_at,
  };
}

function mapManualTakeover(row) {
  if (!row) return null;

  return {
    id: row.id,
    liveTaskId: row.live_task_id,
    liveRoomId: row.live_room_id,
    currentAvatarId: row.current_avatar_id,
    currentAvatar: row.current_avatar_name,
    currentProductGroupId: row.current_product_group_id,
    currentProductGroup: row.current_product_group_name,
    speechStatus: row.speech_status,
    executorStatus: row.executor_status,
    currentSpeech: row.current_speech,
    nextSpeech: row.next_speech,
    upcomingSpeech: fromJson(row.upcoming_speech_json, []),
    recommendedReplies: fromJson(row.recommended_replies_json, []),
    riskWarnings: fromJson(row.risk_warnings_json, []),
    updatedAt: row.updated_at,
  };
}

function mapScriptLoopState(row) {
  if (!row) {
    return {
      id: '',
      liveTaskId: '',
      liveRoomId: '',
      status: LOOP_STATUS_STOPPED,
      mode: LOOP_MODE_TEMPLATE,
      minQueueSize: 3,
      batchSize: 5,
      cursorIndex: 0,
      autoDispatch: false,
      settings: {},
      lastFillAt: '',
      lastTickAt: '',
      createdAt: '',
      updatedAt: '',
    };
  }

  return {
    id: row.id,
    liveTaskId: row.live_task_id,
    liveRoomId: row.live_room_id,
    status: row.status || LOOP_STATUS_STOPPED,
    mode: row.mode || LOOP_MODE_TEMPLATE,
    minQueueSize: Number(row.min_queue_size || 3),
    batchSize: Number(row.batch_size || 5),
    cursorIndex: Number(row.cursor_index || 0),
    autoDispatch: Boolean(row.auto_dispatch),
    settings: fromJson(row.settings_json, {}),
    lastFillAt: row.last_fill_at || '',
    lastTickAt: row.last_tick_at || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function resolveContext(req, res) {
  const taskId = req.query.taskId || req.body?.taskId;
  const task = firstTask(taskId);

  if (!task) {
    fail(res, 'Live task not found', NOT_FOUND, { taskId: taskId || '' });
    return null;
  }

  const room = db.prepare('SELECT * FROM live_rooms WHERE id = ?').get(task.live_room_id);
  return { task, room };
}

function countRows(sql, params = {}) {
  return db.prepare(sql).get(params).count;
}

function clampInteger(value, fallback, min, max) {
  const number = Number.parseInt(value, 10);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(Math.max(number, min), max);
}

function normalizeLoopMode(value) {
  const mode = String(value || '').trim();
  return mode === LOOP_MODE_AI ? LOOP_MODE_AI : LOOP_MODE_TEMPLATE;
}

function textFromEntry(entry) {
  if (entry === undefined || entry === null) return '';
  if (typeof entry === 'string') return entry.trim();
  if (typeof entry === 'number') return String(entry);
  if (typeof entry !== 'object') return '';

  const direct =
    entry.text ||
    entry.script ||
    entry.content ||
    entry.answer ||
    entry.reply ||
    entry.title ||
    entry.name ||
    '';

  if (direct) {
    return String(direct).trim();
  }

  const question = entry.question || entry.q || '';
  const answer = entry.answer || entry.a || '';
  return [question, answer].filter(Boolean).join('，').trim();
}

function listFromSerialized(value) {
  const parsed = fromJson(value, null);
  const source = parsed ?? value;

  if (Array.isArray(source)) {
    return source.map(textFromEntry).filter(Boolean);
  }

  if (source && typeof source === 'object') {
    return Object.values(source).flatMap((item) => listFromSerialized(item)).filter(Boolean);
  }

  return String(source || '')
    .split(/\r?\n|[;；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSpeechText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 260);
}

function uniqueProductRows(rows = []) {
  const map = new Map();

  rows.forEach((row) => {
    if (row?.id && !map.has(row.id)) {
      map.set(row.id, row);
    }
  });

  return [...map.values()];
}

function getTaskProducts(task) {
  const rows = [];

  if (task.product_group_id) {
    rows.push(
      ...db
        .prepare(
          `SELECT p.*, COALESCE(pgi.sort_order, 9999) AS loop_sort_order
           FROM products p
           LEFT JOIN product_group_items pgi
             ON pgi.product_id = p.id AND pgi.product_group_id = @groupId
           WHERE pgi.product_group_id = @groupId OR p.group_id = @groupId
           ORDER BY loop_sort_order ASC, p.id ASC`,
        )
        .all({ groupId: task.product_group_id }),
    );
  }

  if (!rows.length && task.product_group_name) {
    rows.push(
      ...db
        .prepare(
          `SELECT *
           FROM products
           WHERE group_name = @groupName
           ORDER BY updated_at DESC, id ASC
           LIMIT 20`,
        )
        .all({ groupName: task.product_group_name }),
    );
  }

  if (!rows.length) {
    rows.push(...db.prepare('SELECT * FROM products ORDER BY updated_at DESC, id ASC LIMIT 20').all());
  }

  return uniqueProductRows(rows).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category || '',
    brand: row.brand || '',
    price: Number(row.price || 0),
    stock: Number(row.stock || 0),
    status: row.status || '',
    description: row.description || '',
    groupId: row.group_id || '',
    groupName: row.group_name || '',
    sellingPoints: listFromSerialized(row.selling_points),
    faq: listFromSerialized(row.faq),
    scripts: listFromSerialized(row.scripts),
  }));
}

function buildProductScriptSegments(product, task) {
  const productName = product.name || task.product_group_name || '当前商品';
  const segments = product.scripts.map((script) => normalizeSpeechText(script)).filter(Boolean);

  if (segments.length) {
    return segments.map((text) => ({
      productId: product.id,
      productName,
      text,
    }));
  }

  const points = product.sellingPoints.slice(0, 4);
  const faq = product.faq.slice(0, 2);
  const generated = [
    `现在给大家介绍的是${productName}。这款更适合正在看直播间、想快速了解重点的朋友，我们先把核心卖点讲清楚。`,
    points.length
      ? `${productName}的重点是${points.join('、')}。如果你在意实用性和性价比，可以先把这几个点对上自己的需求。`
      : `${productName}主打的是稳定体验和日常实用，适合先看规格、再按自己的使用场景来选择。`,
    product.price
      ? `${productName}当前参考价是${product.price}元，直播间最终价格、优惠和库存以页面显示为准，合适的话可以先领券再下单。`
      : `${productName}的活动价格以直播间页面为准，建议先看优惠券、规格和库存，再决定要不要拍。`,
    product.description
      ? `${productName}补充说明：${product.description}`
      : `如果你对${productName}还有规格、发货或者售后问题，可以直接发在评论区，我会按当前商品继续说明。`,
    ...faq.map((item) => `常见问题：${item}`),
  ];

  return generated
    .map(normalizeSpeechText)
    .filter(Boolean)
    .map((text) => ({
      productId: product.id,
      productName,
      text,
    }));
}

function buildScriptLoopPool(context, state) {
  const products = getTaskProducts(context.task);
  const segments = products.flatMap((product) => buildProductScriptSegments(product, context.task));

  if (!segments.length) {
    const fallbackName = context.task.product_group_name || context.room?.name || '当前直播间';
    segments.push(
      {
        productId: '',
        productName: fallbackName,
        text: `欢迎来到${fallbackName}。我会先介绍当前直播间的重点信息，如果有问题可以直接发在评论区。`,
      },
      {
        productId: '',
        productName: fallbackName,
        text: `接下来我们会按商品卖点、适合人群、价格优惠和常见问题来讲，人工需要插话时可以随时接管。`,
      },
    );
  }

  return {
    products,
    segments,
    mode: state?.mode || LOOP_MODE_TEMPLATE,
  };
}

function getOrCreateScriptLoopState(context) {
  const timestamp = now();
  const id = `LOOP-${context.task.id}`;

  db.prepare(
    `INSERT OR IGNORE INTO live_script_loop_state (
      id, live_task_id, live_room_id, status, mode, min_queue_size, batch_size,
      cursor_index, auto_dispatch, settings_json, last_fill_at, last_tick_at,
      created_at, updated_at
    ) VALUES (
      @id, @liveTaskId, @liveRoomId, @status, @mode, @minQueueSize, @batchSize,
      @cursorIndex, @autoDispatch, @settings, @lastFillAt, @lastTickAt,
      @createdAt, @updatedAt
    )`,
  ).run({
    id,
    liveTaskId: context.task.id,
    liveRoomId: context.task.live_room_id || context.room?.id || '',
    status: LOOP_STATUS_STOPPED,
    mode: LOOP_MODE_TEMPLATE,
    minQueueSize: 3,
    batchSize: 5,
    cursorIndex: 0,
    autoDispatch: 0,
    settings: toJson({ source: 'local_template' }),
    lastFillAt: '',
    lastTickAt: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return db.prepare('SELECT * FROM live_script_loop_state WHERE live_task_id = ?').get(context.task.id);
}

function updateScriptLoopState(context, patch = {}) {
  const existing = getOrCreateScriptLoopState(context);
  const timestamp = now();
  const settings = {
    ...fromJson(existing.settings_json, {}),
    ...(patch.settings || {}),
  };

  db.prepare(
    `UPDATE live_script_loop_state
     SET live_room_id = @liveRoomId,
         status = @status,
         mode = @mode,
         min_queue_size = @minQueueSize,
         batch_size = @batchSize,
         cursor_index = @cursorIndex,
         auto_dispatch = @autoDispatch,
         settings_json = @settings,
         last_fill_at = @lastFillAt,
         last_tick_at = @lastTickAt,
         updated_at = @updatedAt
     WHERE live_task_id = @liveTaskId`,
  ).run({
    liveTaskId: context.task.id,
    liveRoomId: context.task.live_room_id || context.room?.id || existing.live_room_id || '',
    status: patch.status ?? existing.status ?? LOOP_STATUS_STOPPED,
    mode: normalizeLoopMode(patch.mode ?? existing.mode),
    minQueueSize: clampInteger(patch.minQueueSize ?? existing.min_queue_size, 3, 1, 30),
    batchSize: clampInteger(patch.batchSize ?? existing.batch_size, 5, 1, 20),
    cursorIndex: clampInteger(patch.cursorIndex ?? existing.cursor_index, 0, 0, 1000000),
    autoDispatch: patch.autoDispatch === undefined ? Number(existing.auto_dispatch || 0) : patch.autoDispatch ? 1 : 0,
    settings: toJson(settings),
    lastFillAt: patch.lastFillAt ?? existing.last_fill_at ?? '',
    lastTickAt: patch.lastTickAt ?? existing.last_tick_at ?? '',
    updatedAt: timestamp,
  });

  return db.prepare('SELECT * FROM live_script_loop_state WHERE live_task_id = ?').get(context.task.id);
}

function getScriptLoopQueueStats(liveTaskId) {
  const params = {
    liveTaskId,
    source: SOURCE_SCRIPT_LOOP,
    approved: STATUS_APPROVED,
    reviewed: STATUS_REVIEWED,
    soon: STATUS_SOON,
    pendingBroadcast: STATUS_PENDING_DISPATCH,
    failed: STATUS_FAILED,
    dispatching: STATUS_DISPATCHING,
  };
  const dispatchableWhere = `
    live_task_id = @liveTaskId
    AND review_status IN (@approved, @reviewed, @soon)
    AND (
      broadcast_status IS NULL OR broadcast_status = ''
      OR broadcast_status = @pendingBroadcast OR broadcast_status = @failed
    )
  `;

  return {
    dispatchable: countRows(`SELECT COUNT(*) AS count FROM speech_queue WHERE ${dispatchableWhere}`, params),
    scriptLoopDispatchable: countRows(`SELECT COUNT(*) AS count FROM speech_queue WHERE source = @source AND ${dispatchableWhere}`, params),
    dispatching: countRows(
      `SELECT COUNT(*) AS count FROM speech_queue WHERE live_task_id = @liveTaskId AND broadcast_status = @dispatching`,
      params,
    ),
    totalScriptLoop: countRows(
      `SELECT COUNT(*) AS count FROM speech_queue WHERE live_task_id = @liveTaskId AND source = @source`,
      params,
    ),
  };
}

function createScriptLoopSpeechItem(context, segment, sequence) {
  const timestamp = now();
  const speechId = nextId('speech_queue', 'SQ');
  const scheduledTime = `循环-${Date.now()}-${String(sequence).padStart(4, '0')}`;

  db.prepare(
    `INSERT INTO speech_queue (
      id, live_task_id, live_room_id, question_id, comment_id, product_id, product_name,
      text, source, action, tone, risk_level, review_status, broadcast_status,
      executor_command_id, broadcast_result_json, broadcast_error_message,
      broadcast_started_at, broadcast_finished_at, scheduled_time,
      approved_by, approved_at, created_at, updated_at
    ) VALUES (
      @id, @liveTaskId, @liveRoomId, @questionId, @commentId, @productId, @productName,
      @text, @source, @action, @tone, @riskLevel, @reviewStatus, @broadcastStatus,
      @executorCommandId, @broadcastResult, @broadcastErrorMessage,
      @broadcastStartedAt, @broadcastFinishedAt, @scheduledTime,
      @approvedBy, @approvedAt, @createdAt, @updatedAt
    )`,
  ).run({
    id: speechId,
    liveTaskId: context.task.id,
    liveRoomId: context.task.live_room_id || context.room?.id || '',
    questionId: '',
    commentId: '',
    productId: segment.productId || '',
    productName: segment.productName || context.task.product_group_name || '',
    text: normalizeSpeechText(segment.text),
    source: SOURCE_SCRIPT_LOOP,
    action: '\u4ecb\u7ecd\u5546\u54c1',
    tone: '\u81ea\u7136',
    riskLevel: '\u4f4e',
    reviewStatus: STATUS_APPROVED,
    broadcastStatus: STATUS_PENDING_DISPATCH,
    executorCommandId: '',
    broadcastResult: '',
    broadcastErrorMessage: '',
    broadcastStartedAt: '',
    broadcastFinishedAt: '',
    scheduledTime,
    approvedBy: 'script-loop',
    approvedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return db.prepare('SELECT * FROM speech_queue WHERE id = ?').get(speechId);
}

function fillScriptLoopQueue(context, stateRow, options = {}) {
  const state = mapScriptLoopState(stateRow || getOrCreateScriptLoopState(context));
  const statsBefore = getScriptLoopQueueStats(context.task.id);
  const minQueueSize = clampInteger(options.minQueueSize ?? state.minQueueSize, state.minQueueSize || 3, 1, 30);
  const batchSize = clampInteger(options.batchSize ?? state.batchSize, state.batchSize || 5, 1, 20);
  const totalNeeded = Math.max(0, minQueueSize - statsBefore.dispatchable);
  const seedNeeded = statsBefore.scriptLoopDispatchable > 0 ? 0 : 1;
  const needed = options.force ? batchSize : Math.min(batchSize, Math.max(totalNeeded, seedNeeded));

  if (!needed) {
    return {
      inserted: [],
      products: [],
      statsBefore,
      statsAfter: statsBefore,
      skippedReason: 'queue_sufficient',
    };
  }

  const pool = buildScriptLoopPool(context, state);
  const inserted = [];
  let cursorIndex = state.cursorIndex;

  for (let index = 0; index < needed; index += 1) {
    const segment = pool.segments[cursorIndex % pool.segments.length];
    inserted.push(mapSpeech(createScriptLoopSpeechItem(context, segment, cursorIndex)));
    cursorIndex += 1;
  }

  const timestamp = now();
  const updatedState = updateScriptLoopState(context, {
    cursorIndex,
    lastFillAt: timestamp,
    lastTickAt: timestamp,
    settings: {
      source: state.mode === LOOP_MODE_AI ? 'ai_assisted_template_fallback' : 'local_template',
      lastProductCount: pool.products.length,
      lastSegmentCount: pool.segments.length,
      lastInsertedCount: inserted.length,
    },
  });

  return {
    inserted,
    products: pool.products,
    statsBefore,
    statsAfter: getScriptLoopQueueStats(context.task.id),
    loop: mapScriptLoopState(updatedState),
  };
}

function runManualSpeechCompliance(text, context, scenario) {
  const result = checkComplianceText(text);
  const logId = recordComplianceCheck({
    sourcePage: '直播中控台',
    scenario,
    target: context.task.id,
    inputSummary: `liveTaskId=${context.task.id}; textLength=${String(text || '').length}; 不记录完整人工接管话术。`,
    result,
  });

  return {
    result,
    logId,
    riskTips: buildComplianceRiskTips(result),
    blocked: isComplianceBlockingResult(result),
  };
}

function getTaskExecutorOrFail(res, task) {
  if (!task.executor_id) {
    fail(res, '直播任务未绑定执行端，无法立即播报', PARAM_ERROR, {
      liveTaskId: task.id,
    });
    return null;
  }

  const executor = db.prepare('SELECT * FROM executors WHERE id = ?').get(task.executor_id);

  if (!executor) {
    fail(res, '直播任务绑定的执行端不存在', NOT_FOUND, {
      liveTaskId: task.id,
      executorId: task.executor_id,
    });
    return null;
  }

  if (!onlineExecutorStatuses.includes(executor.status)) {
    fail(res, '执行端离线或异常，无法立即播报', PARAM_ERROR, {
      liveTaskId: task.id,
      executorId: executor.id,
      executorStatus: executor.status,
    });
    return null;
  }

  return executor;
}

function createManualSpeechQueueItem(req, context, body, options = {}) {
  const timestamp = now();
  const speechId = nextId('speech_queue', 'SQ');
  const reviewStatus = options.reviewStatus || '已通过';
  const broadcastStatus = options.broadcastStatus || '待下发';
  const isApproved = reviewStatus === '已通过' || reviewStatus === '已审核' || reviewStatus === '即将播出';

  db.prepare(
    `INSERT INTO speech_queue (
      id, live_task_id, live_room_id, question_id, comment_id, product_id, product_name,
      text, source, action, tone, risk_level, review_status, broadcast_status,
      executor_command_id, broadcast_result_json, broadcast_error_message,
      broadcast_started_at, broadcast_finished_at, scheduled_time,
      approved_by, approved_at, created_at, updated_at
    ) VALUES (
      @id, @liveTaskId, @liveRoomId, @questionId, @commentId, @productId, @productName,
      @text, @source, @action, @tone, @riskLevel, @reviewStatus, @broadcastStatus,
      @executorCommandId, @broadcastResult, @broadcastErrorMessage,
      @broadcastStartedAt, @broadcastFinishedAt, @scheduledTime,
      @approvedBy, @approvedAt, @createdAt, @updatedAt
    )`,
  ).run({
    id: speechId,
    liveTaskId: context.task.id,
    liveRoomId: context.task.live_room_id || context.room?.id || '',
    questionId: '',
    commentId: '',
    productId: body.productId || '',
    productName: body.productName || context.task.product_group_name || '',
    text: String(body.text || body.speechText || '').trim(),
    source: 'manual_takeover',
    action: String(body.action || '').trim() || '看评论区',
    tone: String(body.tone || '').trim() || '自然',
    riskLevel: options.riskLevel || body.riskLevel || '低',
    reviewStatus,
    broadcastStatus,
    executorCommandId: '',
    broadcastResult: '',
    broadcastErrorMessage: '',
    broadcastStartedAt: '',
    broadcastFinishedAt: '',
    scheduledTime: body.scheduledTime || '下一句',
    approvedBy: isApproved ? req.authUser?.id || 'manual-takeover' : '',
    approvedAt: isApproved ? timestamp : '',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return db.prepare('SELECT * FROM speech_queue WHERE id = ?').get(speechId);
}

function createSpeakCommandForSpeechItem(req, speechItem, task, executor) {
  const timestamp = now();
  const commandId = nextId('executor_commands', 'CMD');
  const timeoutAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const trace = {
    traceId: `TRACE-${commandId}`,
    eventId: `TRACE-${commandId}`,
    source: 'manual_takeover_direct',
    requestedBy: req.authUser?.id || 'manual-takeover',
    createdAt: timestamp,
  };
  const payload = {
    text: speechItem.text,
    tone: speechItem.tone || '自然',
    source: 'manual_takeover_direct',
    speechQueueId: speechItem.id,
    liveTaskId: task.id,
    liveRoomId: speechItem.live_room_id || task.live_room_id || '',
    trace,
  };

  db.prepare(
    `INSERT INTO executor_commands (
      id, executor_id, command_type, payload_json, status, idempotency_key,
      timeout_at, retry_count, result_message, ack_payload_json,
      created_by, created_at, executed_at, acked_at, updated_at
    ) VALUES (
      @id, @executorId, @commandType, @payload, @status, @idempotencyKey,
      @timeoutAt, @retryCount, @resultMessage, @ackPayload,
      @createdBy, @createdAt, @executedAt, @ackedAt, @updatedAt
    )`,
  ).run({
    id: commandId,
    executorId: executor.id,
    commandType: 'speak',
    payload: toJson(payload),
    status: 'pending',
    idempotencyKey: `${executor.id}:${commandId}`,
    timeoutAt,
    retryCount: 0,
    resultMessage: '人工接管话术已直发为 speak 命令，等待本地执行端回执。',
    ackPayload: null,
    createdBy: req.authUser?.id || 'manual-takeover',
    createdAt: timestamp,
    executedAt: '',
    ackedAt: '',
    updatedAt: timestamp,
  });

  db.prepare(
    `UPDATE speech_queue
     SET broadcast_status = @broadcastStatus,
         executor_command_id = @commandId,
         broadcast_result_json = '',
         broadcast_error_message = '',
         broadcast_started_at = '',
         broadcast_finished_at = '',
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: speechItem.id,
    broadcastStatus: '下发中',
    commandId,
    updatedAt: timestamp,
  });

  return {
    commandId,
    traceId: trace.traceId,
    timeoutAt,
    speechItem: db.prepare('SELECT * FROM speech_queue WHERE id = ?').get(speechItem.id),
  };
}

router.get('/live/control-room/overview', (req, res) => {
  const context = resolveContext(req, res);
  if (!context) return null;

  const { task, room } = context;
  const delayRow = db.prepare('SELECT * FROM delay_control_state WHERE live_task_id = ? ORDER BY updated_at DESC LIMIT 1').get(task.id);
  const outputRow = db.prepare('SELECT * FROM studio_output_status ORDER BY updated_at DESC LIMIT 1').get();
  const manualRow = db.prepare('SELECT * FROM manual_takeover_state WHERE live_task_id = ? ORDER BY updated_at DESC LIMIT 1').get(task.id);
  const commentTotal = countRows('SELECT COUNT(*) AS count FROM comments WHERE live_task_id = @taskId', { taskId: task.id });
  const questionTotal = countRows('SELECT COUNT(*) AS count FROM questions WHERE live_task_id = @taskId', { taskId: task.id });
  const speechReviewTotal = countRows('SELECT COUNT(*) AS count FROM speech_queue WHERE live_task_id = @taskId', { taskId: task.id });
  const highRiskComments = countRows(
    "SELECT COUNT(*) AS count FROM comments WHERE live_task_id = @taskId AND risk_level NOT IN ('低', '无')",
    { taskId: task.id },
  );

  const delayControl = mapDelay(delayRow);
  const outputStatus = mapOutput(outputRow);
  const manualTakeover = mapManualTakeover(manualRow);

  return success(res, {
    task: mapTask(task),
    room: mapRoom(room),
    outputStatus,
    delayControl,
    manualTakeover,
    statusBar: {
      currentLiveTask: task.task_name,
      currentLiveRoom: room?.name || task.live_room_name,
      platform: task.platform,
      currentAvatar: task.avatar_name,
      currentProductGroup: task.product_group_name,
      executorStatus: delayControl?.executorStatus || 'Mock在线',
      obsStatus: outputStatus?.obsStatus || 'Mock未连接',
      delayMode: delayControl?.delayMode || '',
      unhandledCommentCount: commentTotal,
      pendingQuestionCount: questionTotal,
      highRiskCommentCount: highRiskComments,
      pendingSpeechReviewCount: speechReviewTotal,
    },
    riskSummary: delayControl?.riskSummary || {},
    mock: true,
  });
});

router.get('/live/control-room/comments', (req, res) => {
  const context = resolveContext(req, res);
  if (!context) return null;

  const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '20', 10), 1), 100);
  const rows = db
    .prepare('SELECT * FROM comments WHERE live_task_id = @taskId ORDER BY created_at DESC, id DESC LIMIT @limit')
    .all({ taskId: context.task.id, limit });
  const list = rows.map(mapComment);

  return success(res, {
    list,
    nextCursor: list.at(-1)?.id || '',
    unhandledCount: list.length,
    mock: true,
  });
});

router.get('/live/control-room/questions', (req, res) => {
  const context = resolveContext(req, res);
  if (!context) return null;

  const rows = db
    .prepare('SELECT * FROM questions WHERE live_task_id = @taskId ORDER BY created_at DESC, id DESC LIMIT 20')
    .all({ taskId: context.task.id });
  const list = rows.map(mapQuestion);

  return success(res, {
    list,
    pendingCount: list.length,
    mock: true,
  });
});

router.get('/live/control-room/broadcast', (req, res) => {
  const context = resolveContext(req, res);
  if (!context) return null;

  const delayRow = db.prepare('SELECT * FROM delay_control_state WHERE live_task_id = ? ORDER BY updated_at DESC LIMIT 1').get(context.task.id);
  const speechRows = db
    .prepare('SELECT * FROM speech_queue WHERE live_task_id = ? ORDER BY scheduled_time ASC, id ASC LIMIT 20')
    .all(context.task.id);
  const subtitleRow = db.prepare('SELECT * FROM subtitle_settings WHERE live_task_id = ? ORDER BY updated_at DESC LIMIT 1').get(context.task.id);
  const settingsRow = db.prepare('SELECT * FROM delay_settings ORDER BY updated_at DESC LIMIT 1').get();
  const delayControl = mapDelay(delayRow);
  const subtitles = mapSubtitles(subtitleRow);

  return success(res, {
    delayControl,
    currentSpeech: delayControl?.currentSpeech || null,
    nextSpeech: delayControl?.nextSpeech || null,
    upcomingSpeech: delayControl?.upcomingSpeech || [],
    speechQueue: speechRows.map((row, index) => mapSpeech(row, index + 1)),
    subtitles,
    delaySettings: mapDelaySettings(settingsRow),
    mock: true,
  });
});

router.get('/live/control-room/script-loop', (req, res) => {
  const context = resolveContext(req, res);
  if (!context) return null;

  const state = getOrCreateScriptLoopState(context);
  const products = getTaskProducts(context.task);

  return success(res, {
    loop: mapScriptLoopState(state),
    queueStats: getScriptLoopQueueStats(context.task.id),
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      stock: product.stock,
      scriptCount: product.scripts.length,
      sellingPointCount: product.sellingPoints.length,
      faqCount: product.faq.length,
    })),
    mock: false,
  });
});

router.post('/live/control-room/script-loop/start', requirePermission(PERMISSIONS.SPEECH_WRITE), (req, res) => {
  const context = resolveContext(req, res);
  if (!context) return null;

  const body = req.body || {};
  const state = updateScriptLoopState(context, {
    status: LOOP_STATUS_RUNNING,
    mode: body.mode,
    minQueueSize: body.minQueueSize,
    batchSize: body.batchSize,
    autoDispatch: body.autoDispatch,
    lastTickAt: now(),
  });
  const fillResult = fillScriptLoopQueue(context, state, { force: false });
  const loop = fillResult.loop || mapScriptLoopState(db.prepare('SELECT * FROM live_script_loop_state WHERE live_task_id = ?').get(context.task.id));

  return success(res, {
    loop,
    fillResult,
    queueStats: getScriptLoopQueueStats(context.task.id),
    message: '循环讲解已启动，系统会保持待播队列不断稿。',
    mock: false,
  });
});

router.post('/live/control-room/script-loop/pause', requirePermission(PERMISSIONS.SPEECH_WRITE), (req, res) => {
  const context = resolveContext(req, res);
  if (!context) return null;

  const state = updateScriptLoopState(context, {
    status: LOOP_STATUS_PAUSED,
    lastTickAt: now(),
  });

  return success(res, {
    loop: mapScriptLoopState(state),
    queueStats: getScriptLoopQueueStats(context.task.id),
    message: '循环讲解已暂停，人工接管和待播队列仍可继续使用。',
    mock: false,
  });
});

router.post('/live/control-room/script-loop/resume', requirePermission(PERMISSIONS.SPEECH_WRITE), (req, res) => {
  const context = resolveContext(req, res);
  if (!context) return null;

  const state = updateScriptLoopState(context, {
    status: LOOP_STATUS_RUNNING,
    autoDispatch: req.body?.autoDispatch,
    lastTickAt: now(),
  });
  const fillResult = fillScriptLoopQueue(context, state, { force: false });

  return success(res, {
    loop: fillResult.loop || mapScriptLoopState(state),
    fillResult,
    queueStats: getScriptLoopQueueStats(context.task.id),
    message: '循环讲解已继续。',
    mock: false,
  });
});

router.post('/live/control-room/script-loop/stop', requirePermission(PERMISSIONS.SPEECH_WRITE), (req, res) => {
  const context = resolveContext(req, res);
  if (!context) return null;

  const state = updateScriptLoopState(context, {
    status: LOOP_STATUS_STOPPED,
    lastTickAt: now(),
  });

  return success(res, {
    loop: mapScriptLoopState(state),
    queueStats: getScriptLoopQueueStats(context.task.id),
    message: '循环讲解已停止，已生成的待播稿不会被删除。',
    mock: false,
  });
});

router.post('/live/control-room/script-loop/fill', requirePermission(PERMISSIONS.SPEECH_WRITE), (req, res) => {
  const context = resolveContext(req, res);
  if (!context) return null;

  const state = updateScriptLoopState(context, {
    mode: req.body?.mode,
    minQueueSize: req.body?.minQueueSize,
    batchSize: req.body?.batchSize,
    autoDispatch: req.body?.autoDispatch,
    lastTickAt: now(),
  });
  const fillResult = fillScriptLoopQueue(context, state, { force: true });

  return success(res, {
    loop: fillResult.loop || mapScriptLoopState(state),
    fillResult,
    queueStats: getScriptLoopQueueStats(context.task.id),
    message: `已补充 ${fillResult.inserted.length} 条循环讲解稿。`,
    mock: false,
  });
});

router.post('/live/control-room/script-loop/tick', requirePermission(PERMISSIONS.SPEECH_WRITE), (req, res) => {
  const context = resolveContext(req, res);
  if (!context) return null;

  const existing = getOrCreateScriptLoopState(context);
  let state = updateScriptLoopState(context, {
    mode: req.body?.mode,
    minQueueSize: req.body?.minQueueSize,
    batchSize: req.body?.batchSize,
    autoDispatch: req.body?.autoDispatch,
    lastTickAt: now(),
  });
  let fillResult = {
    inserted: [],
    statsBefore: getScriptLoopQueueStats(context.task.id),
    statsAfter: getScriptLoopQueueStats(context.task.id),
    skippedReason: 'not_running',
  };

  if ((state.status || existing.status) === LOOP_STATUS_RUNNING) {
    fillResult = fillScriptLoopQueue(context, state, { force: false });
    state = db.prepare('SELECT * FROM live_script_loop_state WHERE live_task_id = ?').get(context.task.id);
  }

  const loop = mapScriptLoopState(state);
  const queueStats = getScriptLoopQueueStats(context.task.id);

  return success(res, {
    loop,
    fillResult,
    queueStats,
    shouldDispatch: loop.status === LOOP_STATUS_RUNNING && loop.autoDispatch && queueStats.dispatching === 0 && queueStats.dispatchable > 0,
    mock: false,
  });
});

router.post('/live/control-room/manual-speech', requirePermission(PERMISSIONS.LIVE_MANUAL_TAKEOVER), (req, res) => {
  const body = req.body || {};
  const text = body.text || body.speechText || '';

  if (!String(text).trim()) {
    return fail(res, 'Manual speech text is required', 40001, {
      field: 'text',
      reason: 'text cannot be empty',
    });
  }

  const deliveryMode = String(body.deliveryMode || body.mode || '').trim();

  if (deliveryMode === 'queue' || deliveryMode === 'enqueue') {
    const context = resolveContext(req, res);
    if (!context) return null;

    const compliance = runManualSpeechCompliance(text, context, 'manual_takeover_queue');
    const shouldForceReview = compliance.blocked;
    const row = createManualSpeechQueueItem(req, context, body, {
      reviewStatus: shouldForceReview ? '高风险待人工' : body.reviewStatus || '已通过',
      broadcastStatus: shouldForceReview ? '未审核' : '待下发',
      riskLevel: compliance.result.riskLevel,
    });

    return success(res, {
      status: 'queued',
      speechItem: mapSpeech(row),
      riskTips: compliance.riskTips,
      complianceLogId: compliance.logId,
      message: shouldForceReview
        ? '人工接管话术命中高风险规则，已加入待播队列并标记为高风险待人工审核。'
        : '人工接管话术已加入待播队列，后续可在播控区下发。',
      mock: false,
    });
  }

  if (deliveryMode === 'direct' || deliveryMode === 'direct_speak') {
    const context = resolveContext(req, res);
    if (!context) return null;

    const compliance = runManualSpeechCompliance(text, context, 'manual_takeover_direct');

    if (compliance.blocked) {
      return fail(res, '人工接管话术命中高风险合规规则，已阻止立即播报', PARAM_ERROR, buildComplianceErrorDetail(compliance.result));
    }

    const executor = getTaskExecutorOrFail(res, context.task);
    if (!executor) return null;

    const queued = createManualSpeechQueueItem(req, context, body, {
      reviewStatus: '已通过',
      broadcastStatus: '待下发',
      riskLevel: compliance.result.riskLevel,
    });
    const command = createSpeakCommandForSpeechItem(req, queued, context.task, executor);

    return success(res, {
      status: 'dispatched',
      speechItem: mapSpeech(command.speechItem),
      commandId: command.commandId,
      traceId: command.traceId,
      timeoutAt: command.timeoutAt,
      riskTips: compliance.riskTips,
      complianceLogId: compliance.logId,
      executor: {
        id: executor.id,
        name: executor.name,
        status: executor.status,
      },
      message: '人工接管话术已直发为 speak 命令，等待执行端 PrintAdapter 回执。',
      mock: false,
    });
  }

  return success(res, {
    speechId: `MOCK-LCR-${Date.now()}`,
    status: String(body.broadcastMode || '').includes('建议') ? 'suggested' : 'accepted',
    suggestion: String(body.broadcastMode || '').includes('建议')
      ? `Mock suggestion: ${text}. Please review compliance before broadcast.`
      : '',
    mock: true,
    message: 'Mock manual speech accepted by live control room. No digital human, TTS, executor, or OBS call was made.',
  });
});

router.patch('/live/control-room/speech-queue/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM speech_queue WHERE id = ?').get(req.params.id);

  if (!existing) {
    return fail(res, 'Speech queue item not found', 40400, { id: req.params.id });
  }

  const body = req.body || {};
  const operation = body.operation || 'update';
  const patch = {
    text: body.text ?? existing.text,
    action: body.action ?? existing.action,
    tone: body.tone ?? existing.tone,
    riskLevel: body.riskLevel ?? existing.risk_level,
    reviewStatus: body.reviewStatus ?? existing.review_status,
    scheduledTime: body.scheduledTime ?? existing.scheduled_time,
  };

  if (operation === 'approve') patch.reviewStatus = '已通过';
  if (operation === 'delete') patch.reviewStatus = '已删除';
  if (operation === 'insert') {
    patch.reviewStatus = '即将播出';
    patch.scheduledTime = body.scheduledTime || '下一句';
  }
  if (operation === 'markRisk') {
    patch.riskLevel = '高';
    patch.reviewStatus = '高风险待人工';
  }

  db.prepare(
    `UPDATE speech_queue
     SET text = @text,
         action = @action,
         tone = @tone,
         risk_level = @riskLevel,
         review_status = @reviewStatus,
         scheduled_time = @scheduledTime,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: req.params.id,
    ...patch,
    updatedAt: now(),
  });

  const row = db.prepare('SELECT * FROM speech_queue WHERE id = ?').get(req.params.id);
  const item = mapSpeech(row);
  return success(res, {
    id: item.id,
    speechItem: item,
    reviewStatus: item.reviewStatus,
    mock: true,
  });
});

export default router;
