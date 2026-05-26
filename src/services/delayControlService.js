import { delayControl, speechActions, speechSources, speechTones } from '../mock/delayControl';
import { delayModes, delaySettings } from '../mock/delaySettings';
import { reviewStatuses, speechQueue } from '../mock/speechQueue';
import { subtitles } from '../mock/subtitles';

export function getDelayControl() {
  return delayControl;
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

export function getSpeechQueue() {
  return speechQueue;
}

export function getReviewStatuses() {
  return reviewStatuses;
}

export function getSubtitles() {
  return subtitles;
}

export function getDelayModes() {
  return delayModes;
}

export function getDelaySettings() {
  return delaySettings;
}
