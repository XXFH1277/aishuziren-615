import { delayControl, speechActions, speechSources, speechTones } from '../mock/delayControl';
import { delayModes, delaySettings } from '../mock/delaySettings';
import { reviewStatuses, speechQueue } from '../mock/speechQueue';
import { subtitles } from '../mock/subtitles';
import { apiRequest } from './request';

export function getDelayControl(params) {
  if (params === undefined) {
    return delayControl;
  }

  return getCurrentSpeech(params);
}

export async function getCurrentSpeech(params = {}) {
  const result = await apiRequest.get('/api/delay-control/current', params);
  return result.delayControl;
}

export function getSpeechSources() {
  return speechSources;
}

export function getSpeechActions() {
  return speechActions;
}

export function getSpeechTones() {
  return speechTones;
}

export function getSpeechQueue(params) {
  if (params === undefined) {
    return speechQueue;
  }

  return apiRequest.get('/api/delay-control/queue', params);
}

export async function updateSpeechQueueItem(id, data = {}) {
  const result = await apiRequest.patch(`/api/delay-control/queue/${id}`, data);
  return result.speechItem;
}

export async function approveSpeechItem(id, data = {}) {
  return apiRequest.post(`/api/delay-control/queue/${id}/approve`, data);
}

export async function rejectSpeechItem(id, data = {}) {
  return apiRequest.post(`/api/delay-control/queue/${id}/reject`, data);
}

export async function insertSpeechItem(id, data = {}) {
  return apiRequest.post(`/api/delay-control/queue/${id}/insert`, data);
}

export async function deleteSpeechItem(id, data = {}) {
  return apiRequest.delete(`/api/delay-control/queue/${id}`, data);
}

export function getReviewStatuses() {
  return reviewStatuses;
}

export function getSubtitles(params) {
  if (params === undefined) {
    return subtitles;
  }

  return apiRequest.get('/api/delay-control/subtitles', params);
}

export async function saveSubtitleSettings(data = {}) {
  const result = await apiRequest.put('/api/delay-control/subtitles/settings', data);
  return result.subtitles;
}

export function getDelayModes() {
  return delayModes;
}

export function getDelaySettings(params) {
  if (params === undefined) {
    return delaySettings;
  }

  return apiRequest.get('/api/delay-control/settings', params);
}

export async function saveDelaySettings(data = {}) {
  const result = await apiRequest.put('/api/delay-control/settings', data);
  return result.settings;
}
