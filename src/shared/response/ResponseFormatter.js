'use strict';

const { HTTP_STATUS } = require('../constants/http-status.constants');

// ---------------------------------------------------------------------------
// ResponseFormatter
// Enforces a consistent API response envelope across the entire application.
//
// Success:  { success: true,  data: {...},     meta: {...} }
// Error:    { success: false, error: { code, message, details } }
// Paginated:{ success: true,  data: [...],     pagination: {...} }
// ---------------------------------------------------------------------------

class ResponseFormatter {
  /**
   * Send a standard success response.
   *
   * @param {object} reply          - Fastify reply object
   * @param {any}    data           - Response payload
   * @param {string} [message]      - Optional message
   * @param {number} [statusCode]   - HTTP status code (default 200)
   * @param {object} [meta]         - Optional metadata
   */
  static success(reply, data, message = 'Success', statusCode = HTTP_STATUS.OK, meta = null) {
    const response = {
      success: true,
      message,
      data,
    };

    if (meta) {
      response.meta = meta;
    }

    return reply.status(statusCode).send(response);
  }

  /**
   * Send a 201 Created response.
   *
   * @param {object} reply
   * @param {any}    data
   * @param {string} [message]
   */
  static created(reply, data, message = 'Created successfully') {
    return ResponseFormatter.success(reply, data, message, HTTP_STATUS.CREATED);
  }

  /**
   * Send a paginated list response.
   *
   * @param {object} reply
   * @param {Array}  data          - Page items
   * @param {object} pagination    - { page, limit, total, totalPages }
   * @param {string} [message]
   */
  static paginated(reply, data, pagination, message = 'Success') {
    return reply.status(HTTP_STATUS.OK).send({
      success: true,
      message,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.limit),
        hasNextPage: pagination.page < Math.ceil(pagination.total / pagination.limit),
        hasPrevPage: pagination.page > 1,
      },
    });
  }

  /**
   * Send a 204 No Content response.
   *
   * @param {object} reply
   */
  static noContent(reply) {
    return reply.status(HTTP_STATUS.NO_CONTENT).send();
  }

  /**
   * Send an error response.
   * Primarily used by the global error handler.
   *
   * @param {object} reply
   * @param {string} message
   * @param {number} statusCode
   * @param {string} errorCode
   * @param {any}    [details]
   */
  static error(reply, message, statusCode, errorCode, details = null) {
    const response = {
      success: false,
      error: {
        code: errorCode,
        message,
      },
    };

    if (details) {
      response.error.details = details;
    }

    return reply.status(statusCode).send(response);
  }
}

module.exports = { ResponseFormatter };
