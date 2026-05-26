const statusCodeMap = {
  40001: 400,
  40100: 401,
  40300: 403,
  40400: 404,
  40900: 409,
  50000: 500,
};

export function success(res, data = {}, message = 'ok') {
  return res.json({
    code: 0,
    message,
    data,
  });
}

export function fail(res, message = '参数错误', code = 40001, error = null) {
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
