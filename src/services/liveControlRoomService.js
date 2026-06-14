import { apiRequest } from './request';

export async function getLiveControlRoomState(taskId) {
  const params = taskId ? { taskId } : {};
  return apiRequest.get('/api/live/control-room/overview', params);
}

export async function getControlRoomComments(params = {}) {
  return apiRequest.get('/api/live/control-room/comments', params);
}

export async function getControlRoomQuestions(params = {}) {
  return apiRequest.get('/api/live/control-room/questions', params);
}

export async function getControlRoomBroadcast(taskId) {
  const params = taskId ? { taskId } : {};
  return apiRequest.get('/api/live/control-room/broadcast', params);
}

export async function sendControlRoomManualSpeech(data = {}) {
  return apiRequest.post('/api/live/control-room/manual-speech', data);
}

export async function enqueueControlRoomManualSpeech(data = {}) {
  return apiRequest.post('/api/live/control-room/manual-speech', {
    ...data,
    deliveryMode: 'queue',
  });
}

export async function directSpeakControlRoomManualSpeech(data = {}) {
  return apiRequest.post('/api/live/control-room/manual-speech', {
    ...data,
    deliveryMode: 'direct',
  });
}

export async function updateControlRoomSpeechQueueItem(id, data = {}) {
  const result = await apiRequest.patch(`/api/live/control-room/speech-queue/${id}`, data);
  return result.speechItem;
}
