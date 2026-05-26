import { actionTypes, avatarActions as mockAvatarActions } from '../mock/avatarActions';
import { avatarCategories, avatarStatuses, avatars as mockAvatars, voiceOptions } from '../mock/avatars';
import { apiRequest } from './request';

export async function getAvatars(params = {}) {
  return apiRequest.get('/api/avatars', params);
}

export async function getAvatarById(id) {
  const data = await apiRequest.get(`/api/avatars/${id}`);
  return data.avatar;
}

export async function createAvatar(data) {
  const result = await apiRequest.post('/api/avatars', data);
  return result.avatar;
}

export async function updateAvatar(id, data) {
  const result = await apiRequest.put(`/api/avatars/${id}`, data);
  return result.avatar;
}

export function getAvatarCategories() {
  return avatarCategories;
}

export function getAvatarStatuses() {
  return avatarStatuses;
}

export function getVoiceOptions() {
  return voiceOptions;
}

export async function getAvatarActions(params = {}) {
  return apiRequest.get('/api/avatar-actions', params);
}

export function getAvatarActionTypes() {
  return actionTypes;
}

export function getMockAvatars() {
  return mockAvatars;
}

export function getMockAvatarById(id) {
  return mockAvatars.find((item) => item.id === id);
}

export function getMockAvatarActions() {
  return mockAvatarActions;
}
