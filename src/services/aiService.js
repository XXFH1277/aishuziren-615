import { aiCallLogs, aiCallStatuses, aiCallTypes } from '../mock/aiCallLogs';
import { aiCosts } from '../mock/aiCosts';
import { modelProviders, modelRoleSettings, modelStatusOptions, modelUsageScenes } from '../mock/aiModels';
import { promptCategories, promptTemplateStatuses, promptTemplates, promptVariables } from '../mock/promptTemplates';

export function getModelProviders() {
  return modelProviders;
}

export function getModelStatusOptions() {
  return modelStatusOptions;
}

export function getModelRoleSettings() {
  return modelRoleSettings;
}

export function getModelUsageScenes() {
  return modelUsageScenes;
}

export function getPromptTemplates() {
  return promptTemplates;
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

export function getAiCallLogs() {
  return aiCallLogs;
}

export function getAiCallTypes() {
  return aiCallTypes;
}

export function getAiCallStatuses() {
  return aiCallStatuses;
}

export function getAiCosts() {
  return aiCosts;
}
