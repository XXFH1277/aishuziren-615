export const OK = 0;
export const PARAM_ERROR = 40001;
export const UNAUTHORIZED = 40101;
export const DEVICE_UNAUTHORIZED = 40102;
export const BIND_CODE_INVALID = 40002;
export const LOGIN_LOCKED = 42301;
export const FORBIDDEN = 40301;
export const PASSWORD_CHANGE_REQUIRED = 40302;
export const NOT_FOUND = 40401;
export const COMMAND_NOT_FOUND = 40402;
export const SERVER_ERROR = 50001;

export const LEGACY_ERROR_CODES = {
  UNAUTHORIZED: 40100,
  FORBIDDEN: 40300,
  NOT_FOUND: 40400,
  CONFLICT: 40900,
  SERVER_ERROR: 50000,
};

export const ERROR_CODE_MESSAGES = {
  [OK]: 'ok',
  [PARAM_ERROR]: '参数错误',
  [UNAUTHORIZED]: '请先登录',
  [DEVICE_UNAUTHORIZED]: '执行端认证失败',
  [BIND_CODE_INVALID]: '绑定码无效或已过期',
  [LOGIN_LOCKED]: '登录失败次数过多，请稍后再试',
  [FORBIDDEN]: '当前角色没有该操作权限',
  [PASSWORD_CHANGE_REQUIRED]: '请先修改初始密码',
  [NOT_FOUND]: '资源不存在',
  [COMMAND_NOT_FOUND]: '执行端命令不存在',
  [SERVER_ERROR]: '服务器内部错误',
};
