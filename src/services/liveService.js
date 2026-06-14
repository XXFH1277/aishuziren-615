import { livePlatforms, liveRoomStatuses, liveRooms as mockLiveRooms } from '../mock/liveRooms';
import { executorOptions, liveTaskStatuses, liveTasks as mockLiveTasks } from '../mock/liveTasks';
import { apiRequest } from './request';

export async function getLiveRooms(params = {}) {
  return apiRequest.get('/api/live-rooms', params);
}

export async function getLiveRoomById(id) {
  const data = await apiRequest.get(`/api/live-rooms/${id}`);
  return data.liveRoom;
}

export async function createLiveRoom(data) {
  const result = await apiRequest.post('/api/live-rooms', data);
  return result.liveRoom;
}

export async function updateLiveRoom(id, data) {
  const result = await apiRequest.put(`/api/live-rooms/${id}`, data);
  return result.liveRoom;
}

export async function activateLiveRoom(id, data = {}) {
  return apiRequest.post(`/api/live-rooms/${id}/activate`, data);
}

export function getLivePlatforms() {
  return livePlatforms;
}

export function getLiveRoomStatuses() {
  return liveRoomStatuses;
}

export async function getLiveTasks(params = {}) {
  return apiRequest.get('/api/live-tasks', params);
}

export async function getLiveTaskById(id) {
  const data = await apiRequest.get(`/api/live-tasks/${id}`);
  return data.liveTask;
}

export async function createLiveTask(data) {
  const result = await apiRequest.post('/api/live-tasks', data);
  return result.liveTask;
}

export async function updateLiveTaskStatus(id, status) {
  const result = await apiRequest.patch(`/api/live-tasks/${id}/status`, { status });
  return result.liveTask;
}

export function getLiveTaskStatuses() {
  return liveTaskStatuses;
}

export function getExecutorOptions() {
  return executorOptions;
}

export function getMockLiveRooms() {
  return mockLiveRooms;
}

export function getMockLiveTasks() {
  return mockLiveTasks;
}
