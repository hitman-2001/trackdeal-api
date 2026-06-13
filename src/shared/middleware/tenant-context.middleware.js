'use strict';

const { tenantContext } = require('../context/tenant-context');

// ---------------------------------------------------------------------------
// Tenant Context Middleware (Fastify preHandler Hook)
// Extracts tenant identifiers from JWT payload or request headers.
// Wraps downstream route execution inside the TenantContext AsyncLocalStorage.
// ---------------------------------------------------------------------------

/**
 * Fastify preHandler hook to establish the multi-tenant context.
 *
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply}   reply
 * @param {function}                          done
 */
function tenantContextMiddleware(request, reply, done) {
  // 1. Extract tenant IDs (favor verified request.user JWT payload, fallback to headers)
  const organizationId = request.user?.organizationId || request.headers['x-organization-id'] || null;
  const branchId = request.user?.branchId || request.headers['x-branch-id'] || null;
  // organizationType is always sourced from the signed JWT — never from client headers
  const organizationType = request.user?.organizationType || null;

  // 2. Identify if this is a platform override (system task or Super Admin bypass)
  // Secure: NEVER allow the client to set this via HTTP headers
  const isSystemOverride = request.user?.role === 'super_admin';

  const context = {
    organizationId,
    branchId,
    organizationType,
    isSystemOverride,
  };

  // Attach context metadata to request for logging/debugging
  request.tenantContext = context;

  // 3. Run downstream handler and hooks inside the AsyncLocalStorage boundary
  tenantContext.run(context, () => {
    done();
  });
}

module.exports = { tenantContextMiddleware };
