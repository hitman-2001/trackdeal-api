'use strict';

const { AppError } = require('./AppError');
const { HTTP_STATUS } = require('../constants/http-status.constants');

// ---------------------------------------------------------------------------
// Domain Error Classes
// Each error maps to a specific HTTP status code and errorCode pattern.
// ---------------------------------------------------------------------------

/**
 * 400 — Request validation failed (field-level errors from Zod/schema).
 */
class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, HTTP_STATUS.BAD_REQUEST, 'VALIDATION_ERROR', details);
  }
}

/**
 * 401 — User is not authenticated (missing or invalid token).
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED');
  }
}

/**
 * 403 — User is authenticated but does not have permission.
 */
class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, HTTP_STATUS.FORBIDDEN, 'FORBIDDEN');
  }
}

/**
 * 404 — Resource not found.
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource', id = null) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, HTTP_STATUS.NOT_FOUND, 'NOT_FOUND');
  }
}

/**
 * 409 — Conflict (duplicate key, state conflict).
 */
class ConflictError extends AppError {
  constructor(message = 'Resource already exists', details = null) {
    super(message, HTTP_STATUS.CONFLICT, 'CONFLICT', details);
  }
}

/**
 * 422 — Business rule violation.
 * Use when all fields are valid but business logic prevents the operation.
 * Example: "Won lead cannot be modified", "Sold property cannot be reserved"
 */
class BusinessRuleError extends AppError {
  constructor(message, ruleCode = null) {
    super(message, HTTP_STATUS.UNPROCESSABLE_ENTITY, ruleCode || 'BUSINESS_RULE_VIOLATION');
  }
}

/**
 * 429 — Rate limit exceeded.
 */
class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(message, HTTP_STATUS.TOO_MANY_REQUESTS, 'RATE_LIMIT_EXCEEDED');
  }
}

/**
 * 500 — Internal server error (unexpected/programmer errors).
 */
class InternalError extends AppError {
  constructor(message = 'An unexpected error occurred') {
    super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR');
    this.isOperational = false;
  }
}

module.exports = {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  RateLimitError,
  InternalError,
};
