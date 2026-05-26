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

export function getUsers() {
  return users;
}

export function getRoles() {
  return roles;
}

export function getBasicSettings() {
  return basicSettings;
}

export function getNotificationRules() {
  return notificationRules;
}

export function getNotificationChannels() {
  return notificationChannels;
}

export function getOperationLogs() {
  return operationLogs;
}

export function getPermissionTree() {
  return permissionTree;
}

export function getSettingsOptions() {
  return settingsOptions;
}

export function saveBasicSettingsMock(data) {
  return { success: true, data };
}

export function updateUserMock(id, data) {
  return { success: true, id, data };
}

export function updateRoleMock(id, data) {
  return { success: true, id, data };
}
