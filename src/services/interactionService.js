import { commentConnection, commentTypes, comments, interactionLiveRooms, riskLevels } from '../mock/comments';
import { broadcastModes, manualTakeover, takeoverActions, takeoverTones } from '../mock/manualTakeover';
import { aiReplyTemplates, questionStatuses, questions } from '../mock/questions';
import { apiRequest } from './request';

export function getComments(params) {
  if (params === undefined) {
    return comments;
  }

  return apiRequest.get('/api/interaction/comments', params);
}

export async function simulateComment(data = {}) {
  const result = await apiRequest.post('/api/dev/interaction/comments/simulate', data);
  return result.comment;
}

export function getMockComments() {
  return comments;
}

export function getCommentConnection() {
  return commentConnection;
}

export function getCommentTypes() {
  return commentTypes;
}

export function getInteractionLiveRooms() {
  return interactionLiveRooms;
}

export function getRiskLevels() {
  return riskLevels;
}

export function getQuestions(params) {
  if (params === undefined) {
    return questions;
  }

  return apiRequest.get('/api/interaction/questions', params);
}

export async function generateQuestionReply(questionId, data = {}) {
  const result = await apiRequest.post(`/api/interaction/questions/${questionId}/reply`, data);
  return result.question;
}

export async function addQuestionToSpeechQueue(questionId, data = {}) {
  const result = await apiRequest.post(`/api/interaction/questions/${questionId}/add-to-queue`, data);
  return result.question;
}

export async function ignoreQuestion(questionId) {
  const result = await apiRequest.post(`/api/interaction/questions/${questionId}/ignore`, {});
  return result.question;
}

export function getMockQuestions() {
  return questions;
}

export function getQuestionStatuses() {
  return questionStatuses;
}

export function getAiReplyTemplates() {
  return aiReplyTemplates;
}

export function getManualTakeover() {
  return manualTakeover;
}

export async function getManualTakeoverState(params = {}) {
  const result = await apiRequest.get('/api/interaction/manual-takeover', params);
  return result.manualTakeover;
}

export async function sendManualSpeech(data = {}) {
  return apiRequest.post('/api/interaction/manual-speech', data);
}

export function getTakeoverTones() {
  return takeoverTones;
}

export function getTakeoverActions() {
  return takeoverActions;
}

export function getBroadcastModes() {
  return broadcastModes;
}
