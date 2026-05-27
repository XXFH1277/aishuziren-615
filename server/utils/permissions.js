export const PERMISSIONS = {
  PRODUCT_READ: 'product:read',
  PRODUCT_WRITE: 'product:write',
  AVATAR_READ: 'avatar:read',
  AVATAR_WRITE: 'avatar:write',
  LIVE_TASK_START: 'live:task:start',
  SPEECH_REVIEW: 'speech:review',
  EXECUTOR_READ: 'executor:read',
  EXECUTOR_RESTART: 'executor:restart',
  EXECUTOR_UNBIND: 'executor:unbind',
  AI_MODEL_WRITE: 'ai:model:write',
  SETTINGS_USER_WRITE: 'settings:user:write',
  SETTINGS_LOGS_READ: 'settings:logs:read',
};

export const permissionKeys = Object.values(PERMISSIONS);
