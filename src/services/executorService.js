import { executorHeartbeats, heartbeatLevels } from '../mock/executorHeartbeats';
import { executorObsList, obsChecklist } from '../mock/executorObs';
import { bindingDeviceMock, executorStatusOptions, executors } from '../mock/executors';

export function getExecutors() {
  return executors;
}

export function getExecutorById(id) {
  return executors.find((item) => item.id === id);
}

export function getExecutorStatusOptions() {
  return executorStatusOptions;
}

export function getBindingDeviceMock() {
  return bindingDeviceMock;
}

export function getExecutorObsList() {
  return executorObsList;
}

export function getObsChecklist() {
  return obsChecklist;
}

export function getExecutorHeartbeats() {
  return executorHeartbeats;
}

export function getHeartbeatLevels() {
  return heartbeatLevels;
}
