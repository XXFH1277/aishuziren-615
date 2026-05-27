import { executorHeartbeats, heartbeatLevels } from '../mock/executorHeartbeats';
import { executorObsList as mockExecutorObsList, obsChecklist } from '../mock/executorObs';
import { bindingDeviceMock, executorStatusOptions, executors as mockExecutors } from '../mock/executors';
import { apiRequest } from './request';

export async function getExecutors(params = {}) {
  return apiRequest.get('/api/executors', params);
}

export async function getExecutorById(id) {
  const data = await apiRequest.get(`/api/executors/${id}`);
  return data.executor;
}

export function getExecutorStatusOptions() {
  return executorStatusOptions;
}

export function getBindingDeviceMock() {
  return bindingDeviceMock;
}

export async function bindExecutorMock(data = {}) {
  return apiRequest.post('/api/executors/bind', data);
}

export async function restartExecutor(id, data = {}) {
  return apiRequest.post(`/api/executors/${id}/restart`, data);
}

export async function unbindExecutor(id, data = {}) {
  return apiRequest.post(`/api/executors/${id}/unbind`, data);
}

export async function refreshExecutorConfig(id, data = {}) {
  return apiRequest.post(`/api/executors/${id}/refresh-config`, data);
}

export async function testExecutorObsConnection(id, data = {}) {
  return apiRequest.post(`/api/executors/${id}/obs/test`, data);
}

export async function refreshExecutorObsScenes(id, data = {}) {
  return apiRequest.post(`/api/executors/${id}/obs/refresh-scenes`, data);
}

export async function getExecutorObsStatus(params = {}) {
  return apiRequest.get('/api/executor-obs', params);
}

export async function getExecutorObsList(params = {}) {
  return getExecutorObsStatus(params);
}

export async function getExecutorObsStatusByExecutorId(executorId) {
  const data = await apiRequest.get(`/api/executor-obs/${executorId}`);
  return data.obsStatus;
}

export async function getExecutorObsByExecutorId(executorId) {
  return getExecutorObsStatusByExecutorId(executorId);
}

export function getObsChecklist() {
  return obsChecklist;
}

export async function getExecutorHeartbeats(params = {}) {
  return apiRequest.get('/api/executor-heartbeats', params);
}

export async function getExecutorHeartbeatsByExecutorId(executorId, params = {}) {
  return apiRequest.get(`/api/executor-heartbeats/${executorId}`, params);
}

export function getHeartbeatLevels() {
  return heartbeatLevels;
}

export function getMockExecutors() {
  return mockExecutors;
}

export function getMockExecutorObsList() {
  return mockExecutorObsList;
}

export function getMockExecutorHeartbeats() {
  return executorHeartbeats;
}
