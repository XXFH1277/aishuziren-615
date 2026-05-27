import {
  basicSettings,
  notificationChannels,
  notificationRules,
  operationLogs,
  permissionTree,
  roles,
  settingsOptions,
  users,
} from '../mock/settings';
import { apiRequest } from './request';

export async function getUsers(params = {}) {
  return apiRequest.get('/api/settings/users', params);
}

export async function getRoles(params = {}) {
  return apiRequest.get('/api/settings/roles', params);
}

export async function getBasicSettings() {
  const data = await apiRequest.get('/api/settings/basic');
  return data.settings || data.basicSettings || {};
}

export function getNotificationRules() {
  return notificationRules;
}

export function getNotificationChannels() {
  return notificationChannels;
}

export async function getOperationLogs(params = {}) {
  return apiRequest.get('/api/settings/logs', params);
}

export function getPermissionTree() {
  return permissionTree;
}

export function getSettingsOptions() {
  return settingsOptions;
}

export async function saveBasicSettings(data) {
  const result = await apiRequest.put('/api/settings/basic', data);
  return result.settings || result.basicSettings || {};
}

export function updateUserMock(id, data) {
  return { success: true, id, data };
}

export function updateRoleMock(id, data) {
  return { success: true, id, data };
}

export function getMockUsers() {
  return users;
}

export function getMockRoles() {
  return roles;
}

export function getMockBasicSettings() {
  return basicSettings;
}

export function getMockOperationLogs() {
  return operationLogs;
}
