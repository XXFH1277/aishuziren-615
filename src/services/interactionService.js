import { commentConnection, commentTypes, comments, interactionLiveRooms, riskLevels } from '../mock/comments';
import { broadcastModes, manualTakeover, takeoverActions, takeoverTones } from '../mock/manualTakeover';
import { aiReplyTemplates, questionStatuses, questions } from '../mock/questions';

export function getComments() {
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

export function getQuestions() {
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

export function getTakeoverTones() {
  return takeoverTones;
}

export function getTakeoverActions() {
  return takeoverActions;
}

export function getBroadcastModes() {
  return broadcastModes;
}
