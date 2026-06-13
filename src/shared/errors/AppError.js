'use strict';

const { HTTP_STATUS } = require('../constants/http-status.constants');

// ---------------------------------------------------------------------------
// AppError — Base Application Error
// All domain errors extend from this class.
// ---------------------------------------------------------------------------

class AppError extends Error {
  /**
   * @param {string} message       - Human-readable error message
   * @param {number} statusCode    - HTTP status code
   * @param {string} errorCode     - Machine-readable error code (e.g. LEAD_NOT_FOUND)
   * @param {object} [details]     - Optional additional error context
   */
  constructor(message, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, errorCode = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true; // Distinguishes operational errors from programmer errors

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.errorCode,
        message: this.message,
        details: this.details,
      },
    };
  }
}

module.exports = { AppError };
