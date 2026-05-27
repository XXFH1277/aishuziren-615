import { FORBIDDEN, LEGACY_ERROR_CODES, NOT_FOUND, OK, PARAM_ERROR, SERVER_ERROR, UNAUTHORIZED } from './errorCodes.js';

const statusCodeMap = {
  [PARAM_ERROR]: 400,
  [UNAUTHORIZED]: 401,
  [FORBIDDEN]: 403,
  [NOT_FOUND]: 404,
  [SERVER_ERROR]: 500,
  [LEGACY_ERROR_CODES.UNAUTHORIZED]: 401,
  [LEGACY_ERROR_CODES.FORBIDDEN]: 403,
  [LEGACY_ERROR_CODES.NOT_FOUND]: 404,
  [LEGACY_ERROR_CODES.CONFLICT]: 409,
  [LEGACY_ERROR_CODES.SERVER_ERROR]: 500,
};

export function success(res, data = {}, message = 'ok') {
  return res.json({
    code: OK,
    message,
    data,
  });
}

export function fail(res, message = '参数错误', code = PARAM_ERROR, error = null) {
  const statusCode = statusCodeMap[code] || 400;

  return res.status(statusCode).json({
    code,
    message,
    error,
  });
}

export function page(res, list = [], total = 0, pageNumber = 1, pageSize = 20) {
  return success(res, {
    list,
    total,
    page: pageNumber,
    pageSize,
  });
}
