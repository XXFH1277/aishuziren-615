import express from 'express';
import { db, fromJson, nextId, now, toJson } from '../db/database.js';
import { fail, page, success } from '../utils/response.js';
import { assertRequired, toValidationErrorPayload } from '../utils/validators.js';

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

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    brand: row.brand,
    price: Number(row.price || 0),
    stock: Number(row.stock || 0),
    status: row.status,
    image: row.image,
    description: row.description,
    groupId: row.group_id,
    groupName: row.group_name,
    sellingPoints: fromJson(row.selling_points, []),
    faq: fromJson(row.faq, []),
    scripts: fromJson(row.scripts, []),
    forbiddenExpressions: fromJson(row.forbidden_expressions, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProductGroup(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    productCount: Number(row.product_count || 0),
    mainProduct: row.main_product,
    liveRoom: row.live_room,
    productIds: fromJson(row.product_ids_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeProductBody(body, existing = {}) {
  return {
    name: body.name ?? existing.name,
    category: body.category ?? existing.category ?? '',
    brand: body.brand ?? existing.brand ?? '',
    price: Number(body.price ?? existing.price ?? 0),
    stock: Number(body.stock ?? existing.stock ?? 0),
    status: body.status ?? existing.status ?? '草稿',
    image: body.image ?? existing.image ?? '',
    description: body.description ?? existing.description ?? '',
    groupId: body.groupId ?? body.group_id ?? existing.group_id ?? '',
    groupName: body.groupName ?? body.group_name ?? existing.group_name ?? '',
    sellingPoints: body.sellingPoints ?? existing.selling_points ?? [],
    faq: body.faq ?? existing.faq ?? [],
    scripts: body.scripts ?? existing.scripts ?? [],
    forbiddenExpressions: body.forbiddenExpressions ?? existing.forbidden_expressions ?? [],
  };
}

router.get('/products', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = {
    limit: pageSize,
    offset,
  };
  const clauses = [];

  if (req.query.keyword) {
    params.keyword = `%${req.query.keyword}%`;
    clauses.push('(name LIKE @keyword OR brand LIKE @keyword OR description LIKE @keyword)');
  }

  if (req.query.category) {
    params.category = req.query.category;
    clauses.push('category = @category');
  }

  if (req.query.status) {
    params.status = req.query.status;
    clauses.push('status = @status');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM products ${whereSql}`).get(params).count;
  const rows = db
    .prepare(`SELECT * FROM products ${whereSql} ORDER BY updated_at DESC LIMIT @limit OFFSET @offset`)
    .all(params);

  return page(res, rows.map(mapProduct), total, pageNumber, pageSize);
});

router.get('/products/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);

  if (!row) {
    return fail(res, '商品不存在', 40400, { id: req.params.id });
  }

  return success(res, { product: mapProduct(row) });
});

router.post('/products', (req, res) => {
  const payload = normalizeProductBody(req.body || {});

  try {
    assertRequired(payload.name, 'name', '商品名称不能为空');
  } catch (error) {
    return fail(res, '参数错误', error.code, toValidationErrorPayload(error));
  }

  const timestamp = now();
  const id = req.body?.id || nextId('products', 'P');

  db.prepare(
    `INSERT INTO products (
      id, name, category, brand, price, stock, status, image, description,
      group_id, group_name, selling_points, faq, scripts, forbidden_expressions,
      created_at, updated_at
    ) VALUES (
      @id, @name, @category, @brand, @price, @stock, @status, @image, @description,
      @groupId, @groupName, @sellingPoints, @faq, @scripts, @forbiddenExpressions,
      @createdAt, @updatedAt
    )`,
  ).run({
    ...payload,
    id,
    sellingPoints: toJson(payload.sellingPoints),
    faq: toJson(payload.faq),
    scripts: toJson(payload.scripts),
    forbiddenExpressions: toJson(payload.forbiddenExpressions),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  return success(res, { product: mapProduct(product) }, 'created');
});

router.put('/products/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);

  if (!existing) {
    return fail(res, '商品不存在', 40400, { id: req.params.id });
  }

  const payload = normalizeProductBody(req.body || {}, existing);

  if (!payload.name || !String(payload.name).trim()) {
    return fail(res, '商品名称不能为空', 40001, { field: 'name', reason: '名称不能为空' });
  }

  db.prepare(
    `UPDATE products SET
      name = @name,
      category = @category,
      brand = @brand,
      price = @price,
      stock = @stock,
      status = @status,
      image = @image,
      description = @description,
      group_id = @groupId,
      group_name = @groupName,
      selling_points = @sellingPoints,
      faq = @faq,
      scripts = @scripts,
      forbidden_expressions = @forbiddenExpressions,
      updated_at = @updatedAt
    WHERE id = @id`,
  ).run({
    ...payload,
    id: req.params.id,
    sellingPoints: toJson(payload.sellingPoints),
    faq: toJson(payload.faq),
    scripts: toJson(payload.scripts),
    forbiddenExpressions: toJson(payload.forbiddenExpressions),
    updatedAt: now(),
  });

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  return success(res, { product: mapProduct(product) });
});

router.patch('/products/:id/status', (req, res) => {
  const { status } = req.body || {};

  if (!status) {
    return fail(res, '商品状态不能为空', 40001, { field: 'status', reason: '状态不能为空' });
  }

  const result = db
    .prepare('UPDATE products SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, now(), req.params.id);

  if (result.changes === 0) {
    return fail(res, '商品不存在', 40400, { id: req.params.id });
  }

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  return success(res, { product: mapProduct(product) });
});

router.get('/product-groups', (req, res) => {
  const { pageNumber, pageSize, offset } = getPagination(req);
  const params = {
    limit: pageSize,
    offset,
  };
  const clauses = [];

  if (req.query.keyword) {
    params.keyword = `%${req.query.keyword}%`;
    clauses.push('(name LIKE @keyword OR main_product LIKE @keyword OR live_room LIKE @keyword)');
  }

  if (req.query.type) {
    params.type = req.query.type;
    clauses.push('type = @type');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM product_groups ${whereSql}`).get(params).count;
  const rows = db
    .prepare(`SELECT * FROM product_groups ${whereSql} ORDER BY updated_at DESC LIMIT @limit OFFSET @offset`)
    .all(params);

  return page(res, rows.map(mapProductGroup), total, pageNumber, pageSize);
});

router.post('/product-groups', (req, res) => {
  const body = req.body || {};

  if (!body.name || !String(body.name).trim()) {
    return fail(res, '商品组名称不能为空', 40001, { field: 'name', reason: '名称不能为空' });
  }

  const timestamp = now();
  const id = body.id || nextId('product_groups', 'G');

  db.prepare(
    `INSERT INTO product_groups (
      id, name, type, product_count, main_product, live_room, product_ids_json, created_at, updated_at
    ) VALUES (
      @id, @name, @type, @productCount, @mainProduct, @liveRoom, @productIds, @createdAt, @updatedAt
    )`,
  ).run({
    id,
    name: body.name,
    type: body.type || '',
    productCount: Number(body.productCount || 0),
    mainProduct: body.mainProduct || '',
    liveRoom: body.liveRoom || '',
    productIds: toJson(body.productIds || []),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const group = db.prepare('SELECT * FROM product_groups WHERE id = ?').get(id);
  return success(res, { productGroup: mapProductGroup(group) }, 'created');
});

export default router;
