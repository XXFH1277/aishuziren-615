import { actionTypes, avatarActions } from '../mock/avatarActions';
import { avatarCategories, avatarStatuses, avatars, voiceOptions } from '../mock/avatars';

export function getAvatars() {
  return avatars;
}

export function getAvatarById(id) {
  return avatars.find((item) => item.id === id);
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

export function getAvatarActions() {
  return avatarActions;
}

export function getAvatarActionTypes() {
  return actionTypes;
}
