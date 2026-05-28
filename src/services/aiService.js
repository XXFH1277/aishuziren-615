import { aiCallLogs, aiCallStatuses, aiCallTypes } from '../mock/aiCallLogs';
import { aiCosts } from '../mock/aiCosts';
import { modelProviders, modelRoleSettings, modelStatusOptions, modelUsageScenes } from '../mock/aiModels';
import { promptCategories, promptTemplateStatuses, promptTemplates, promptVariables } from '../mock/promptTemplates';
import { apiRequest } from './request';

export async function getAiAssistantSettings() {
  const result = await apiRequest.get('/api/ai/assistant');
  return result.assistant;
}

export async function saveAiAssistantSettings(data = {}) {
  const result = await apiRequest.put('/api/ai/assistant', data);
  return result.assistant;
}

export function getModelProviders(params) {
  if (params === undefined) {
    return modelProviders;
  }

  return apiRequest.get('/api/ai/models', params);
}

export async function getAiModels(params = {}) {
  return getModelProviders(params);
}

export async function getAiRuntimePolicy() {
  return apiRequest.get('/api/ai/runtime-policy');
}

export async function updateAiModel(id, data = {}) {
  const result = await apiRequest.put(`/api/ai/models/${id}`, data);
  return result.model;
}

export async function saveModelCredentials(id, data = {}) {
  const result = await apiRequest.put(`/api/ai/models/${id}/credentials`, data);
  return result.credential;
}

export async function getModelCredentials(id) {
  const result = await apiRequest.get(`/api/ai/models/${id}/credentials`);
  return result.credential;
}

export async function deleteModelCredentials(id) {
  const result = await apiRequest.delete(`/api/ai/models/${id}/credentials`);
  return result.credential;
}

export async function testAiModel(id, data = {}) {
  return apiRequest.post(`/api/ai/models/${id}/test`, data);
}

export async function generateAiContent(data = {}) {
  return apiRequest.post('/api/ai/generate', data);
}

export async function generateProductCopy(data = {}) {
  return generateAiContent({
    ...data,
    scenario: 'product_copy',
  });
}

export async function updateModelDefaults(data = {}) {
  return apiRequest.patch('/api/ai/models/defaults', data);
}

export function getModelStatusOptions() {
  return modelStatusOptions;
}

export function getModelRoleSettings(params) {
  if (params === undefined) {
    return modelRoleSettings;
  }

  return apiRequest.get('/api/ai/models/defaults', params);
}

export function getModelUsageScenes() {
  return modelUsageScenes;
}

export function getPromptTemplates(params) {
  if (params === undefined) {
    return promptTemplates;
  }

  return apiRequest.get('/api/ai/prompts', params);
}

export async function createPromptTemplate(data = {}) {
  const result = await apiRequest.post('/api/ai/prompts', data);
  return result.template;
}

export async function updatePromptTemplate(id, data = {}) {
  const result = await apiRequest.put(`/api/ai/prompts/${id}`, data);
  return result.template;
}

export async function copyPromptTemplate(id) {
  return apiRequest.post(`/api/ai/prompts/${id}/copy`, {});
}

export function getPromptCategories() {
  return promptCategories;
}

export function getPromptTemplateStatuses() {
  return promptTemplateStatuses;
}

export function getPromptVariables() {
  return promptVariables;
}

export function getAiCallLogs(params) {
  if (params === undefined) {
    return aiCallLogs;
  }

  return apiRequest.get('/api/ai/logs', params);
}

export function getAiCallTypes() {
  return aiCallTypes;
}

export function getAiCallStatuses() {
  return aiCallStatuses;
}

export function getAiCosts(params) {
  if (params === undefined) {
    return aiCosts;
  }

  return apiRequest.get('/api/ai/costs', params);
}

export async function saveAiBudgetSettings(data = {}) {
  return apiRequest.patch('/api/ai/costs/budget', data);
}
