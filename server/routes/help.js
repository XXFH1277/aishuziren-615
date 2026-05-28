import express from 'express';
import { db, fromJson, nextId, now } from '../db/database.js';
import { fail, page, success } from '../utils/response.js';

const router = express.Router();

function getPagination(req) {
  const pageNumber = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
  const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize || '20', 10), 1), 100);

  return {
    pageNumber,
    pageSize,
    offset: (pageNumber - 1) * pageSize,
  };
}

function distinct(tableName, columnName) {
  return db
    .prepare(`SELECT DISTINCT ${columnName} AS value FROM ${tableName} WHERE ${columnName} IS NOT NULL AND ${columnName} != '' ORDER BY ${columnName} ASC`)
    .all()
    .map((row) => row.value);
}

function mapFaq(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    causes: fromJson(row.causes_json, []),
    steps: fromJson(row.steps_json, []),
    relatedPage: row.related_page,
    needSupport: Boolean(Number(row.need_support || 0)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTroubleshooting(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description,
    steps: fromJson(row.steps_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTicket(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    urgency: row.urgency,
    priority: row.urgency,
    liveRoom: row.related_live_room,
    relatedLiveRoom: row.related_live_room,
    avatar: row.related_avatar,
    relatedAvatar: row.related_avatar,
    product: row.related_product,
    relatedProduct: row.related_product,
    executor: row.related_executor,
    relatedExecutor: row.related_executor,
    status: row.status,
    submitter: row.submitter,
    submittedAt: row.submitted_at,
    description: row.description,
    diagnosis: row.diagnosis,
    errorLog: row.error_log,
    reply: row.technical_reply,
    technicalReply: row.technical_reply,
    resolution: row.resolution_record,
    resolutionRecord: row.resolution_record,
    contact: row.contact,
    attachments: getTicketAttachments(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAttachment(row) {
  return {
    id: row.id,
    fileId: row.file_id,
    fileName: row.file_name,
    fileUrl: row.file_url,
    fileType: row.file_type,
    size: Number(row.size || 0),
    mimeType: row.mime_type,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

function getTicketAttachments(ticketId) {
  return db
    .prepare('SELECT * FROM ticket_attachments WHERE ticket_id = ? ORDER BY created_at ASC')
    .all(ticketId)
    .map(mapAttachment);
}

function normalizeAttachmentIds(body) {
  const idsFromAttachments = Array.isArray(body.attachments)
    ? body.attachments.map((item) => item.fileId || item.id).filter(Boolean)
    : [];
  const idsFromAttachmentIds = Array.isArray(body.attachmentIds) ? body.attachmentIds.filter(Boolean) : [];

  return [...new Set([...idsFromAttachments, ...idsFromAttachmentIds])].slice(0, 3);
}

function mapTutorial(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    difficulty: row.difficulty,
    duration: row.duration,
    summary: fromJson(row.summary_json, []),
    targetPage: row.target_page,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSystemStatus(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    checkedAt: row.checked_at,
    abnormalCount: Number(row.abnormal_count || 0),
    description: row.detail,
    detail: row.detail,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapChangelog(row) {
  return {
    id: row.id,
    version: row.version,
    title: row.title,
    updatedAt: row.updated_at,
    features: fromJson(row.features_json, []),
    fixes: fromJson(row.fixes_json, []),
    notes: fromJson(row.notes_json, []),
    important: Boolean(Number(row.important || 0)),
    createdAt: row.created_at,
  };
}

router.get('/help/faq', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = { limit: pageSize, offset };
  const clauses = [];

  if (req.query.keyword) {
    params.keyword = `%${req.query.keyword}%`;
    clauses.push('(title LIKE @keyword OR causes_json LIKE @keyword OR steps_json LIKE @keyword)');
  }

  if (req.query.category) {
    params.category = req.query.category;
    clauses.push('category = @category');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM help_faq ${whereSql}`).get(params).count;
  const rows = db.prepare(`SELECT * FROM help_faq ${whereSql} ORDER BY id ASC LIMIT @limit OFFSET @offset`).all(params);

  return success(res, {
    list: rows.map(mapFaq),
    categories: distinct('help_faq', 'category'),
    total,
    page: pageNumber,
    pageSize,
  });
});

router.get('/help/troubleshooting', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = { limit: pageSize, offset };
  const clauses = [];

  if (req.query.keyword) {
    params.keyword = `%${req.query.keyword}%`;
    clauses.push('(title LIKE @keyword OR description LIKE @keyword OR steps_json LIKE @keyword)');
  }

  if (req.query.category) {
    params.category = req.query.category;
    clauses.push('category = @category');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM troubleshooting_guides ${whereSql}`).get(params).count;
  const rows = db
    .prepare(`SELECT * FROM troubleshooting_guides ${whereSql} ORDER BY id ASC LIMIT @limit OFFSET @offset`)
    .all(params);

  return page(res, rows.map(mapTroubleshooting), total, pageNumber, pageSize);
});

router.get('/help/tickets', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = { limit: pageSize, offset };
  const clauses = [];

  if (req.query.keyword) {
    params.keyword = `%${req.query.keyword}%`;
    clauses.push('(id LIKE @keyword OR title LIKE @keyword OR description LIKE @keyword)');
  }

  if (req.query.type) {
    params.type = req.query.type;
    clauses.push('type = @type');
  }

  if (req.query.status) {
    params.status = req.query.status;
    clauses.push('status = @status');
  }

  const priority = req.query.priority || req.query.urgency;
  if (priority) {
    params.urgency = priority;
    clauses.push('urgency = @urgency');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM tickets ${whereSql}`).get(params).count;
  const rows = db.prepare(`SELECT * FROM tickets ${whereSql} ORDER BY submitted_at DESC LIMIT @limit OFFSET @offset`).all(params);

  return page(res, rows.map(mapTicket), total, pageNumber, pageSize);
});

router.post('/help/tickets', (req, res) => {
  const body = req.body || {};

  if (!body.description) {
    return fail(res, '问题描述不能为空', 40001);
  }

  const timestamp = now();
  const id = nextId('tickets', 'TK');
  const title = body.title || `${body.type || '技术工单'}-${id}`;
  const attachmentIds = normalizeAttachmentIds(body);

  db.prepare(
    `INSERT INTO tickets (
      id, title, type, urgency, related_live_room, related_avatar, related_product,
      related_executor, status, submitter, submitted_at, description, diagnosis,
      error_log, technical_reply, resolution_record, contact, created_at, updated_at
    ) VALUES (
      @id, @title, @type, @urgency, @relatedLiveRoom, @relatedAvatar, @relatedProduct,
      @relatedExecutor, @status, @submitter, @submittedAt, @description, @diagnosis,
      @errorLog, @technicalReply, @resolutionRecord, @contact, @createdAt, @updatedAt
    )`,
  ).run({
    id,
    title,
    type: body.type || '执行端问题',
    urgency: body.priority || body.urgency || '中',
    relatedLiveRoom: body.relatedLiveRoom || body.liveRoom || '',
    relatedAvatar: body.relatedAvatar || body.avatar || '',
    relatedProduct: body.relatedProduct || body.product || '',
    relatedExecutor: body.relatedExecutor || body.executor || '',
    status: '待处理',
    submitter: body.submitter || '当前用户 Mock',
    submittedAt: timestamp,
    description: body.description,
    diagnosis: 'Mock 诊断：工单已写入本地 SQLite，暂不连接真实工单系统。',
    errorLog: body.errorLog || 'no real external ticket request by design',
    technicalReply: '暂无技术回复。',
    resolutionRecord: '未解决。',
    contact: body.contact || '',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  attachmentIds.forEach((fileId) => {
    const file = db.prepare('SELECT * FROM file_assets WHERE id = ? LIMIT 1').get(fileId);

    if (!file) {
      return;
    }

    db.prepare(
      `INSERT INTO ticket_attachments (
        id, ticket_id, file_id, file_name, file_url, file_type,
        size, mime_type, uploaded_by, created_at
      ) VALUES (
        @id, @ticketId, @fileId, @fileName, @fileUrl, @fileType,
        @size, @mimeType, @uploadedBy, @createdAt
      )`,
    ).run({
      id: nextId('ticket_attachments', 'TA'),
      ticketId: id,
      fileId: file.id,
      fileName: file.file_name,
      fileUrl: file.file_url,
      fileType: file.file_type,
      size: Number(file.size || 0),
      mimeType: file.mime_type,
      uploadedBy: file.uploaded_by,
      createdAt: timestamp,
    });

    db.prepare('UPDATE file_assets SET business_id = ? WHERE id = ?').run(id, file.id);
  });

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
  return success(res, { id, ticket: mapTicket(ticket) });
});

router.get('/help/tutorials', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = { limit: pageSize, offset };
  const clauses = [];

  if (req.query.category) {
    params.category = req.query.category;
    clauses.push('category = @category');
  }

  if (req.query.difficulty) {
    params.difficulty = req.query.difficulty;
    clauses.push('difficulty = @difficulty');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM tutorials ${whereSql}`).get(params).count;
  const rows = db.prepare(`SELECT * FROM tutorials ${whereSql} ORDER BY id ASC LIMIT @limit OFFSET @offset`).all(params);

  return success(res, {
    list: rows.map(mapTutorial),
    categories: distinct('tutorials', 'category'),
    total,
    page: pageNumber,
    pageSize,
  });
});

router.get('/help/status', (req, res) => {
  const params = {};
  const clauses = [];

  if (req.query.serviceName) {
    params.serviceName = `%${req.query.serviceName}%`;
    clauses.push('name LIKE @serviceName');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM system_status ${whereSql} ORDER BY id ASC`).all(params);
  const list = rows.map(mapSystemStatus);
  const summary = {
    normal: list.filter((item) => ['正常', 'Mock运行中'].includes(item.status)).length,
    abnormal: list.filter((item) => ['异常', '部分异常'].includes(item.status)).length,
    reserved: list.filter((item) => ['预留', '未配置'].includes(item.status)).length,
    totalAbnormal: list.reduce((sum, item) => sum + item.abnormalCount, 0),
  };

  return success(res, { list, summary });
});

router.get('/help/changelog', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = { limit: pageSize, offset };
  const clauses = [];

  if (req.query.version) {
    params.version = req.query.version;
    clauses.push('version = @version');
  }

  if (req.query.important !== undefined && req.query.important !== '') {
    params.important = req.query.important === 'true' || req.query.important === '1' ? 1 : 0;
    clauses.push('important = @important');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM changelog ${whereSql}`).get(params).count;
  const rows = db.prepare(`SELECT * FROM changelog ${whereSql} ORDER BY updated_at DESC, id DESC LIMIT @limit OFFSET @offset`).all(params);

  return page(res, rows.map(mapChangelog), total, pageNumber, pageSize);
});

export default router;
