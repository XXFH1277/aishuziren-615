import { livePlatforms, liveRoomStatuses, liveRooms } from '../mock/liveRooms';
import { executorOptions, liveTaskStatuses, liveTasks } from '../mock/liveTasks';

export function getLiveRooms() {
  return liveRooms;
}

export function getLiveRoomById(id) {
  return liveRooms.find((item) => item.id === id);
}

export function getLivePlatforms() {
  return livePlatforms;
}

export function getLiveRoomStatuses() {
  return liveRoomStatuses;
}

export function getLiveTasks() {
  return liveTasks;
}

export function getLiveTaskStatuses() {
  return liveTaskStatuses;
}

export function getExecutorOptions() {
  return executorOptions;
}
