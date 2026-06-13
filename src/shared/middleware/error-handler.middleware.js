'use strict';

const { AppError } = require('../errors');
const { ResponseFormatter } = require('../response/ResponseFormatter');
const { HTTP_STATUS } = require('../constants/http-status.constants');

// ---------------------------------------------------------------------------
// Global Error Handler
// Registered as Fastify's setErrorHandler.
// Converts all errors — operational and unexpected — into consistent responses.
// ---------------------------------------------------------------------------

/**
 * Fastify global error handler.
 *
 * Error classification:
 *   AppError (isOperational=true)  → formatted domain error response
 *   Mongoose ValidationError       → 400 with field-level details
 *   Mongoose CastError             → 400 invalid ID format
 *   Mongoose Duplicate Key (11000) → 409 conflict
 *   JWT errors                     → 401 unauthorized
 *   Everything else                → 500 internal server error
 *
 * @param {Error} error
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply}   reply
 */
async function globalErrorHandler(error, request, reply) {
  const logger = request.log || request.server.log;

  // ------------------------------------------------------------------
  // 1. Operational (domain) errors — expected, well-defined
  // ------------------------------------------------------------------
  if (error instanceof AppError && error.isOperational) {
    logger.warn({ err: error, requestId: request.requestId }, error.message);

    return ResponseFormatter.error(
      reply,
      error.message,
      error.statusCode,
      error.errorCode,
      error.details,
    );
  }

  // ------------------------------------------------------------------
  // 2. Fastify validation errors (JSON Schema / Ajv)
  // ------------------------------------------------------------------
  if (error.validation) {
    logger.warn({ validationErrors: error.validation }, 'Fastify schema validation failed');

    return ResponseFormatter.error(
      reply,
      'Validation failed',
      HTTP_STATUS.BAD_REQUEST,
      'VALIDATION_ERROR',
      error.validation.map((v) => ({
        field: v.instancePath || v.params?.missingProperty || 'unknown',
        message: v.message,
      })),
    );
  }

  // ------------------------------------------------------------------
  // 3. Mongoose errors
  // ------------------------------------------------------------------
  if (error.name === 'ValidationError' && error.errors) {
    // Mongoose schema validation
    const details = Object.keys(error.errors).map((field) => ({
      field,
      message: error.errors[field].message,
    }));

    logger.warn({ details }, 'Mongoose validation error');

    return ResponseFormatter.error(
      reply,
      'Validation failed',
      HTTP_STATUS.BAD_REQUEST,
      'VALIDATION_ERROR',
      details,
    );
  }

  if (error.name === 'CastError') {
    logger.warn({ err: error }, 'Mongoose CastError — invalid ID format');

    return ResponseFormatter.error(
      reply,
      `Invalid value for field '${error.path}'`,
      HTTP_STATUS.BAD_REQUEST,
      'INVALID_ID_FORMAT',
    );
  }

  if (error.code === 11000) {
    // MongoDB duplicate key error
    const field = Object.keys(error.keyValue || {})[0] || 'unknown';
    logger.warn({ err: error }, 'MongoDB duplicate key error');

    return ResponseFormatter.error(
      reply,
      `Duplicate value for field '${field}'`,
      HTTP_STATUS.CONFLICT,
      'DUPLICATE_KEY',
      { field, value: error.keyValue?.[field] },
    );
  }

  // ------------------------------------------------------------------
  // 4. JWT errors (from @fastify/jwt — handled before hitting here
  //    via authenticate middleware, but kept as safety net)
  // ------------------------------------------------------------------
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return ResponseFormatter.error(
      reply,
      'Invalid or expired token',
      HTTP_STATUS.UNAUTHORIZED,
      'UNAUTHORIZED',
    );
  }

  // ------------------------------------------------------------------
  // 5. Unexpected errors — programmer errors, not operational
  // ------------------------------------------------------------------
  logger.error({ err: error, requestId: request.requestId }, 'Unexpected internal server error');

  // In production, never leak internal error details
  const message =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please contact support.'
      : error.message;

  return ResponseFormatter.error(
    reply,
    message,
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    'INTERNAL_ERROR',
  );
}

module.exports = { globalErrorHandler };
