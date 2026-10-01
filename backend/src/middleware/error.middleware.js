'use strict';

const logger = require('../common/logger');
const { AppError } = require('../utils/errors');
const { error: errorResponse } = require('../utils/response');

/**
 * Global error handler — always LAST middleware.
 * Formats errors into a consistent JSON envelope.
 */
// eslint-disable-next-line no-unused-vars
const globalErrorHandler = (err, req, res, next) => {
  // Prisma known errors
  if (err && err.code && typeof err.code === 'string' && err.code.startsWith('P')) {
    // P2002 = unique constraint failed
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'field';
      return errorResponse(res, `Duplicate value for ${target}`, 409);
    }
    if (err.code === 'P2025') {
      return errorResponse(res, 'Record not found', 404);
    }
  }

  if (err && err.name === 'TokenExpiredError') {
    return errorResponse(res, 'Token expired', 401);
  }
  if (err && err.name === 'JsonWebTokenError') {
    return errorResponse(res, 'Invalid token', 401);
  }

  if (err instanceof AppError) {
    return errorResponse(res, err.message, err.statusCode, err.errors);
  }

  logger.error(`Unhandled error: ${err && err.stack ? err.stack : err}`);
  return errorResponse(res, err?.message || 'Internal Server Error', 500);
};

const notFoundHandler = (req, res) =>
  errorResponse(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);

module.exports = { globalErrorHandler, notFoundHandler };
