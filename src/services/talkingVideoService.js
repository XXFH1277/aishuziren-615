import { apiRequest } from './request';

export async function getTalkingVideoJobs(params = {}) {
  return apiRequest.get('/api/talking-videos/jobs', params);
}

export async function getTalkingVideoJob(id) {
  const result = await apiRequest.get(`/api/talking-videos/jobs/${id}`);
  return result.job;
}

export async function createTalkingVideoJob(data = {}) {
  const result = await apiRequest.post('/api/talking-videos/jobs', data);
  return result;
}

export async function updateTalkingVideoJobStatus(id, data = {}) {
  const result = await apiRequest.patch(`/api/talking-videos/jobs/${id}/status`, data);
  return result.job;
}

export async function finishTalkingVideoJob(id, data = {}) {
  const result = await apiRequest.post(`/api/talking-videos/jobs/${id}/result`, data);
  return result.job;
}
