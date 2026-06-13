'use strict';

const { UnauthorizedError } = require('../errors');
const { tenantContext } = require('../context/tenant-context');

// ---------------------------------------------------------------------------
// Authentication Middleware (Fastify preHandler)
// Verifies JWT access token from the Authorization header.
// Attaches the decoded user payload to request.user.
// Hardens security by checking token age against password change timestamp.
// ---------------------------------------------------------------------------

/**
 * Fastify preHandler hook — authenticates the request and validates token lifespan.
 * Throws UnauthorizedError if the token is missing, invalid, or issued before a password change.
 *
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply}   reply
 */
async function authenticate(request, reply) {
  try {
    // @fastify/jwt attaches .jwtVerify() to request
    await request.jwtVerify();
  } catch (err) {
    throw new UnauthorizedError(
      err.message === 'jwt expired'
        ? 'Access token has expired. Please refresh your session.'
        : 'Invalid or missing authentication token.',
    );
  }

  // Hardened Verification: Ensure user exists, is active, and hasn't changed password since token issuance
  const decoded = request.user;
  if (!decoded || !decoded.id) {
    throw new UnauthorizedError('Invalid token payload.');
  }

  const { UserRepository } = require('../../modules/user/user.repository');
  const userRepo = new UserRepository();

  // Run database checks in bypass context since we are validating authentication
  const user = await tenantContext.run({ isSystemOverride: true }, () =>
    userRepo.findById(decoded.id)
  );

  if (!user) {
    throw new UnauthorizedError('User session invalid. Account not found.');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('Your account has been deactivated. Contact your administrator.');
  }

  // Validate parent organization subscription status (Super Admins are exempt)
  if (user.role !== 'super_admin') {
    const { Organization } = require('../../modules/organization/organization.model');
    const org = await tenantContext.run({ isSystemOverride: true }, () =>
      Organization.findById(user.organizationId)
    );

    if (!org || org.isDeleted) {
      throw new UnauthorizedError('Organization account not found.');
    }

    if (org.subscription.status === 'suspended') {
      throw new UnauthorizedError('Your organization account has been suspended due to billing. Please contact billing support.');
    }

    if (org.subscription.status === 'cancelled') {
      throw new UnauthorizedError('Your organization account has been cancelled.');
    }
  }

  // Validate Token Issue Date against Password Changed Date (mitigates stolen access token vulnerability)
  if (user.passwordChangedAt && decoded.iat * 1000 < user.passwordChangedAt.getTime()) {
    throw new UnauthorizedError('Your session has expired due to a recent password change. Please log in again.');
  }
}

/**
 * Optional authentication — attaches user if token present, but doesn't throw.
 * Useful for public endpoints that behave differently for authenticated users.
 *
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply}   reply
 */
async function optionalAuthenticate(request, reply) {
  try {
    await request.jwtVerify();
    
    const decoded = request.user;
    if (decoded && decoded.id) {
      const { UserRepository } = require('../../modules/user/user.repository');
      const userRepo = new UserRepository();

      const user = await tenantContext.run({ isSystemOverride: true }, () =>
        userRepo.findById(decoded.id)
      );

      if (user && user.isActive) {
        let isSuspended = false;
        if (user.role !== 'super_admin') {
          const { Organization } = require('../../modules/organization/organization.model');
          const org = await tenantContext.run({ isSystemOverride: true }, () =>
            Organization.findById(user.organizationId)
          );
          if (!org || org.isDeleted || org.subscription.status === 'suspended' || org.subscription.status === 'cancelled') {
            isSuspended = true;
          }
        }

        if (!isSuspended) {
          // Validate password change window
          if (!user.passwordChangedAt || decoded.iat * 1000 >= user.passwordChangedAt.getTime()) {
            request.user = decoded;
            return;
          }
        }
      }
    }
    request.user = undefined; // Strip payload if verification checks fail
  } catch {
    request.user = undefined; // Silently ignore — request.user will be undefined
  }
}

module.exports = { authenticate, optionalAuthenticate };
