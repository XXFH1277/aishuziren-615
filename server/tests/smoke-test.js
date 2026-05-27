const DEFAULT_BASE_URL = 'http://localhost:3000';
const baseUrl = (process.env.SMOKE_BASE_URL || process.env.API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 5000);
const passedChecks = [];

function pass(name, detail = '') {
  passedChecks.push({ name, detail });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function requestJson(name, path, options = {}) {
  if (typeof fetch !== 'function') {
    throw new Error('当前 Node 版本不支持原生 fetch，请使用 Node 18+ 后再运行 smoke test。');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const url = new URL(path, `${baseUrl}/`).toString();

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const responseText = await response.text();
    let payload;

    try {
      payload = JSON.parse(responseText);
    } catch {
      throw new Error(`${name} 返回非 JSON 内容：HTTP ${response.status}`);
    }

    if (!response.ok || payload.code !== 0) {
      throw new Error(`${name} 失败：HTTP ${response.status} code=${payload.code} message=${payload.message || 'unknown'}`);
    }

    return payload.data || {};
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`${name} 超时：${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkList(name, path) {
  const data = await requestJson(name, path);
  assert(Array.isArray(data.list), `${name} 未返回 list 数组`);
  assert(data.list.length > 0, `${name} list 为空，请先运行 npm run server:seed`);
  pass(name, `${data.list.length} 条`);
  return data.list;
}

async function checkDetail(name, path, key, id) {
  const data = await requestJson(name, path);
  assert(data[key]?.id === id, `${name} 返回详情 ID 不匹配，期望 ${id}`);
  pass(name, id);
  return data[key];
}

async function run() {
  console.log(`Local API smoke test: ${baseUrl}`);

  const health = await requestJson('健康检查 API', '/api/health');
  assert(health.status === 'ok', '健康检查 API 未返回 status=ok');
  pass('健康检查 API', '/api/health');

  const products = await checkList('商品 API：商品列表', '/api/products');
  await checkDetail('商品 API：商品详情', `/api/products/${products[0].id}`, 'product', products[0].id);
  await checkList('商品 API：商品组列表', '/api/product-groups');

  const avatars = await checkList('数字人 API：数字人列表', '/api/avatars');
  await checkDetail('数字人 API：数字人详情', `/api/avatars/${avatars[0].id}`, 'avatar', avatars[0].id);
  await checkList('数字人 API：动作库列表', '/api/avatar-actions');

  const liveRooms = await checkList('直播管理 API：直播间列表', '/api/live-rooms');
  await checkDetail('直播管理 API：直播间详情', `/api/live-rooms/${liveRooms[0].id}`, 'liveRoom', liveRooms[0].id);
  await checkList('直播管理 API：直播任务列表', '/api/live-tasks');

  await checkList('系统设置 API：用户列表', '/api/settings/users');
  await checkList('系统设置 API：角色列表', '/api/settings/roles');
  const basicSettings = await requestJson('系统设置 API：基础设置', '/api/settings/basic');
  assert(basicSettings.settings && typeof basicSettings.settings === 'object', '系统设置 API：基础设置未返回 settings 对象');
  pass('系统设置 API：基础设置', '/api/settings/basic');
  await checkList('系统设置 API：操作日志', '/api/settings/logs');

  await checkList('帮助中心 API：FAQ', '/api/help/faq');
  await checkList('帮助中心 API：快速排查', '/api/help/troubleshooting');
  await checkList('帮助中心 API：工单列表', '/api/help/tickets');
  await checkList('帮助中心 API：教程列表', '/api/help/tutorials');
  await checkList('帮助中心 API：系统状态', '/api/help/status');
  await checkList('帮助中心 API：更新日志', '/api/help/changelog');

  const executors = await checkList('执行端 API：执行端列表', '/api/executors');
  await checkDetail('执行端 API：执行端详情', `/api/executors/${executors[0].id}`, 'executor', executors[0].id);
  const obsList = await checkList('执行端 API：OBS 状态列表', '/api/executor-obs');
  const obsDetail = await requestJson('执行端 API：单执行端 OBS 状态', `/api/executor-obs/${obsList[0].executorId}`);
  assert(obsDetail.obsStatus?.executorId === obsList[0].executorId, '执行端 API：单执行端 OBS 状态返回 executorId 不匹配');
  pass('执行端 API：单执行端 OBS 状态', obsList[0].executorId);
  const heartbeats = await checkList('执行端 API：心跳日志', '/api/executor-heartbeats');
  assert(heartbeats[0].executorId, '执行端 API：心跳日志缺少 executorId');
  pass('执行端 API：心跳日志字段检查', heartbeats[0].executorId);
  const bindResult = await requestJson('执行端 API：绑定信息 Mock', '/api/executors/bind', {
    method: 'POST',
    body: { expiresInMinutes: 10 },
  });
  assert(bindResult.code && bindResult.bindUrl, '执行端 API：绑定信息 Mock 未返回 code 或 bindUrl');
  pass('执行端 API：绑定信息 Mock', bindResult.code);

  console.log(`\nSmoke Test 通过：${passedChecks.length} 项`);
  passedChecks.forEach((item, index) => {
    const detail = item.detail ? ` - ${item.detail}` : '';
    console.log(`${String(index + 1).padStart(2, '0')}. ${item.name}${detail}`);
  });
}

run().catch((error) => {
  console.error('\nSmoke Test 失败');
  console.error(error.message);

  if (passedChecks.length) {
    console.error('\n已通过项目：');
    passedChecks.forEach((item, index) => {
      const detail = item.detail ? ` - ${item.detail}` : '';
      console.error(`${String(index + 1).padStart(2, '0')}. ${item.name}${detail}`);
    });
  }

  process.exit(1);
});
