const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const API_UNAVAILABLE_MESSAGE = '本地 API 服务未连接，请先运行 npm run server:dev';
const AUTH_TOKEN_KEY = 'szr_live_auth_token';

function buildUrl(path, params) {
  const url = new URL(path, API_BASE_URL);

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

function formatApiError(payload, response) {
  const reason = payload?.error?.reason;
  const field = payload?.error?.field;
  const detail = [field, reason].filter(Boolean).join('：');

  if (payload?.message && detail) {
    return `${payload.message}（${detail}）`;
  }

  return payload?.message || detail || `请求失败：HTTP ${response.status}`;
}

async function request(path, { method = 'GET', params, data } = {}) {
  let response;
  const token = typeof localStorage === 'undefined' ? '' : localStorage.getItem(AUTH_TOKEN_KEY);
  const headers = {};

  if (data !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers: Object.keys(headers).length ? headers : undefined,
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  } catch {
    throw new Error(API_UNAVAILABLE_MESSAGE);
  }

  let payload;

  try {
    payload = await response.json();
  } catch {
    throw new Error(`本地 API 返回格式异常：HTTP ${response.status}`);
  }

  if (!response.ok || payload.code !== 0) {
    throw new Error(formatApiError(payload, response));
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

export { API_BASE_URL, API_UNAVAILABLE_MESSAGE, AUTH_TOKEN_KEY };
