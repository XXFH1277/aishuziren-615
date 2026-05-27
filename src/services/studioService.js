import { studioCategories, studioRatios, studioRoomTypes, studioVisualStyles } from '../mock/studioBackgrounds';
import { studioLayers } from '../mock/studioLayouts';
import { outputMethods } from '../mock/studioOutput';
import { apiRequest } from './request';

export async function getStudioBackgrounds(params = {}) {
  return apiRequest.get('/api/studio/backgrounds', params);
}

export async function generateStudioBackgroundMock(data) {
  const result = await apiRequest.post('/api/studio/backgrounds/generate-mock', data);
  return result.background;
}

export function getStudioRoomTypes() {
  return studioRoomTypes;
}

export function getStudioCategories() {
  return studioCategories;
}

export function getStudioVisualStyles() {
  return studioVisualStyles;
}

export function getStudioRatios() {
  return studioRatios;
}

export async function getStudioLayouts(params = {}) {
  return apiRequest.get('/api/studio/layouts', params);
}

export function getStudioLayers() {
  return studioLayers;
}

export async function getStudioOutputStatus() {
  const data = await apiRequest.get('/api/studio/output-status');
  return data.outputStatus;
}

export async function getStudioOutput() {
  return getStudioOutputStatus();
}

export function getOutputMethods() {
  return outputMethods;
}
