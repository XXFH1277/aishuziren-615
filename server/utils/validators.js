import { PARAM_ERROR } from './errorCodes.js';

export class ValidationError extends Error {
  constructor(field, reason) {
    super(reason);
    this.name = 'ValidationError';
    this.code = PARAM_ERROR;
    this.field = field;
    this.reason = reason;
  }
}

export function required(value) {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

export function assertRequired(value, fieldName, reason = `${fieldName}不能为空`) {
  if (!required(value)) {
    throw new ValidationError(fieldName, reason);
  }

  return value;
}

export function validatePagination(page = 1, pageSize = 20) {
  const pageNumber = Number.parseInt(page || '1', 10);
  const sizeNumber = Number.parseInt(pageSize || '20', 10);

  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new ValidationError('page', '页码必须为大于 0 的整数');
  }

  if (!Number.isInteger(sizeNumber) || sizeNumber < 1 || sizeNumber > 100) {
    throw new ValidationError('pageSize', '每页数量必须为 1-100 的整数');
  }

  return {
    pageNumber,
    pageSize: sizeNumber,
    offset: (pageNumber - 1) * sizeNumber,
  };
}

export function toValidationErrorPayload(error) {
  return {
    field: error.field || 'unknown',
    reason: error.reason || error.message || '参数错误',
  };
}
