'use strict';

const { ResponseFormatter } = require('../response/ResponseFormatter');

// ---------------------------------------------------------------------------
// BaseController
// All domain controllers extend this class.
//
// Controllers MUST remain thin:
//   ✅ Extract and validate request data
//   ✅ Call service method
//   ✅ Return formatted response
//
//   ❌ No business logic
//   ❌ No direct database access
//   ❌ No authorization logic (handled by preHandler hooks)
// ---------------------------------------------------------------------------

class BaseController {
  /**
   * @param {object} deps
   * @param {import('./BaseService')} deps.service - Domain service
   * @param {import('pino').Logger}   deps.logger  - Logger
   */
  constructor({ service, logger = console }) {
    this.service = service;
    this.logger = logger;

    // Bind all methods to preserve `this` when used as Fastify handlers
    this._bindMethods();
  }

  // -------------------------------------------------------------------------
  // Response Helpers
  // -------------------------------------------------------------------------

  /**
   * Send a success response.
   */
  ok(reply, data, message) {
    return ResponseFormatter.success(reply, data, message);
  }

  /**
   * Send a 201 Created response.
   */
  created(reply, data, message) {
    return ResponseFormatter.created(reply, data, message);
  }

  /**
   * Send a paginated response.
   */
  paginated(reply, data, pagination, message) {
    return ResponseFormatter.paginated(reply, data, pagination, message);
  }

  /**
   * Send a 204 No Content response.
   */
  noContent(reply) {
    return ResponseFormatter.noContent(reply);
  }

  // -------------------------------------------------------------------------
  // Request Extraction Helpers
  // -------------------------------------------------------------------------

  /**
   * Get the authenticated user from the request.
   * @param {object} request - Fastify request
   * @returns {object} user
   */
  getUser(request) {
    return request.user;
  }

  /**
   * Get the authenticated user's ID.
   * @param {object} request - Fastify request
   * @returns {string}
   */
  getUserId(request) {
    return request.user?.id;
  }

  /**
   * Extract and parse pagination query params.
   * @param {object} query - Fastify request.query
   * @returns {{ page: number, limit: number, sort: string, order: string }}
   */
  getPagination(query) {
    const order = query.order === 'asc' || query.order === '1' || query.order === 1 ? 1 : -1;
    return {
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
      sort: query.sort || 'createdAt',
      order,
      search: query.search || '',
    };
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  /**
   * Auto-bind all own methods to preserve `this` context when
   * Fastify uses them as route handlers.
   */
  _bindMethods() {
    const proto = Object.getPrototypeOf(this);
    Object.getOwnPropertyNames(proto).forEach((method) => {
      if (method !== 'constructor' && typeof this[method] === 'function') {
        this[method] = this[method].bind(this);
      }
    });
  }
}

module.exports = { BaseController };
