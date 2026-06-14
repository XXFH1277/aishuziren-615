import { apiRequest } from './request';

// 数字人实时会话：开播 / 查询 / 驱动说话 / 下播。
// 后端默认走 stub（占位），配腾讯凭证后切真实，前端调用方式不变。

export async function openLiveSession(data = {}) {
  return apiRequest.post('/api/live/sessions', data);
}

export async function getLiveSessionEngines(params = {}) {
  return apiRequest.get('/api/live/sessions/engines', params);
}

export async function getLiveSession(id) {
  return apiRequest.get(`/api/live/sessions/${id}`);
}

export async function connectLiveSession(id, data = {}) {
  return apiRequest.post(`/api/live/sessions/${id}/connect`, data);
}

export async function speakLiveSession(id, data = {}) {
  return apiRequest.post(`/api/live/sessions/${id}/speak`, data);
}

export async function closeLiveSession(id) {
  return apiRequest.post(`/api/live/sessions/${id}/close`, {});
}
