const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function buildUrl(path, params) {
  const url = new URL(path, API_BASE_URL);

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

async function request(path, { method = 'GET', params, data } = {}) {
  let response;

  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers: data === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  } catch (error) {
    throw new Error('本地 API 服务未连接，请先运行 npm run server:dev');
  }

  let payload;

  try {
    payload = await response.json();
  } catch {
    throw new Error(`本地 API 返回格式异常：HTTP ${response.status}`);
  }

  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.message || `请求失败：HTTP ${response.status}`);
  }

  return payload.data;
}

export const apiRequest = {
  get(path, params) {
    return request(path, { method: 'GET', params });
  },
  post(path, data) {
    return request(path, { method: 'POST', data });
  },
  put(path, data) {
    return request(path, { method: 'PUT', data });
  },
  patch(path, data) {
    return request(path, { method: 'PATCH', data });
  },
  delete(path, data) {
    return request(path, { method: 'DELETE', data });
  },
};

export { API_BASE_URL };
