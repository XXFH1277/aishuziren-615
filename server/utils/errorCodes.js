export const OK = 0;
export const PARAM_ERROR = 40001;
export const UNAUTHORIZED = 40101;
export const FORBIDDEN = 40301;
export const NOT_FOUND = 40401;
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
  [FORBIDDEN]: '当前角色没有该操作权限',
  [NOT_FOUND]: '资源不存在',
  [SERVER_ERROR]: '服务器内部错误',
};
