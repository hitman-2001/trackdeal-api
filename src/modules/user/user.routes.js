'use strict';

const { authenticate } = require('../../shared/middleware/authenticate.middleware');
const { requirePermission } = require('../../shared/middleware/authorize.middleware');
const { PERMISSIONS } = require('../../shared/constants/roles-permissions.constants');
const { UserController } = require('./user.controller');
const {
  userIdParamSchema,
  createUserSchema,
  updateUserSchema,
  assignRoleSchema,
  assignBranchSchema,
  transferBranchSchema,
  inviteUserSchema,
  cancelInviteSchema,
  resendInviteSchema,
  acceptInviteSchema,
  updateProfileSchema,
  changePasswordSchema,
} = require('./user.validation');

/**
 * User Module Routes
 * Base prefix: /users
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} opts
 */
async function userRoutes(fastify, opts) {
  const controller = new UserController();

  // Authentication Hook: Protect all routes except the public Invitation Acceptance
  fastify.addHook('preValidation', async (request, reply) => {
    if (request.url.endsWith('/invite/accept')) {
      return; // Public endpoint
    }
    await authenticate(request, reply);
  });

  // -------------------------------------------------------------------------
  // User Directory REST Routes
  // -------------------------------------------------------------------------

  fastify.get('/', {
    preHandler: [requirePermission(PERMISSIONS.USERS_READ)],
    schema: {
      tags: ['Users'],
      summary: 'List all users in organization context',
    },
    handler: controller.list,
  });

  fastify.get('/:id', {
    preHandler: [requirePermission(PERMISSIONS.USERS_READ)],
    schema: {
      tags: ['Users'],
      summary: 'Get user details by ID',
      params: userIdParamSchema,
    },
    handler: controller.getById,
  });

  fastify.post('/', {
    preHandler: [requirePermission(PERMISSIONS.USERS_CREATE)],
    schema: {
      tags: ['Users'],
      summary: 'Create a new user directly',
      body: createUserSchema,
    },
    handler: controller.create,
  });

  fastify.put('/:id', {
    preHandler: [requirePermission(PERMISSIONS.USERS_UPDATE)],
    schema: {
      tags: ['Users'],
      summary: 'Update user details',
      params: userIdParamSchema,
      body: updateUserSchema,
    },
    handler: controller.update,
  });

  fastify.delete('/:id', {
    preHandler: [requirePermission(PERMISSIONS.USERS_DELETE)],
    schema: {
      tags: ['Users'],
      summary: 'Soft-delete a user',
      params: userIdParamSchema,
    },
    handler: controller.remove,
  });

  fastify.post('/:id/restore', {
    preHandler: [requirePermission(PERMISSIONS.USERS_DELETE)],
    schema: {
      tags: ['Users'],
      summary: 'Restore a soft-deleted user account',
      params: userIdParamSchema,
    },
    handler: controller.restore,
  });

  // -------------------------------------------------------------------------
  // User Account Status Controls
  // -------------------------------------------------------------------------

  fastify.post('/:id/activate', {
    preHandler: [requirePermission(PERMISSIONS.USERS_ACTIVATE)],
    schema: {
      tags: ['Users'],
      summary: 'Activate a deactivated user account',
      params: userIdParamSchema,
    },
    handler: controller.activate,
  });

  fastify.post('/:id/deactivate', {
    preHandler: [requirePermission(PERMISSIONS.USERS_DEACTIVATE)],
    schema: {
      tags: ['Users'],
      summary: 'Deactivate a user account',
      params: userIdParamSchema,
    },
    handler: controller.deactivate,
  });

  fastify.post('/:id/suspend', {
    preHandler: [requirePermission(PERMISSIONS.USERS_DEACTIVATE)],
    schema: {
      tags: ['Users'],
      summary: 'Suspend a user account',
      params: userIdParamSchema,
    },
    handler: controller.suspend,
  });

  // -------------------------------------------------------------------------
  // Role & Branch Transfer / Assignments
  // -------------------------------------------------------------------------

  fastify.post('/:id/assign-role', {
    preHandler: [requirePermission(PERMISSIONS.USERS_UPDATE)],
    schema: {
      tags: ['Users'],
      summary: 'Assign a new role to a user',
      params: userIdParamSchema,
      body: assignRoleSchema,
    },
    handler: controller.assignRole,
  });

  fastify.post('/:id/assign-branch', {
    preHandler: [requirePermission(PERMISSIONS.USERS_UPDATE)],
    schema: {
      tags: ['Users'],
      summary: 'Assign a branch to a user',
      params: userIdParamSchema,
      body: assignBranchSchema,
    },
    handler: controller.assignBranch,
  });

  fastify.post('/:id/transfer-branch', {
    preHandler: [requirePermission(PERMISSIONS.USERS_UPDATE)],
    schema: {
      tags: ['Users'],
      summary: 'Transfer a user to a different branch',
      params: userIdParamSchema,
      body: transferBranchSchema,
    },
    handler: controller.transferBranch,
  });

  // -------------------------------------------------------------------------
  // Secure Cryptographic Invitations
  // -------------------------------------------------------------------------

  fastify.post('/invite', {
    preHandler: [requirePermission(PERMISSIONS.USERS_CREATE)],
    schema: {
      tags: ['Users'],
      summary: 'Invite a user to the organization',
      body: inviteUserSchema,
    },
    handler: controller.invite,
  });

  fastify.post('/invite/resend', {
    preHandler: [requirePermission(PERMISSIONS.USERS_CREATE)],
    schema: {
      tags: ['Users'],
      summary: 'Resend an active pending invitation token',
      body: resendInviteSchema,
    },
    handler: controller.resendInvite,
  });

  fastify.post('/invite/cancel', {
    preHandler: [requirePermission(PERMISSIONS.USERS_CREATE)],
    schema: {
      tags: ['Users'],
      summary: 'Cancel an active pending invitation',
      body: cancelInviteSchema,
    },
    handler: controller.cancelInvite,
  });



  // -------------------------------------------------------------------------
  // Personal Profile Management
  // -------------------------------------------------------------------------

  fastify.get('/me', {
    schema: {
      tags: ['Profile'],
      summary: 'Fetch the authenticated user own profile details',
    },
    handler: controller.getMe,
  });

  fastify.put('/me', {
    schema: {
      tags: ['Profile'],
      summary: 'Update own profile details',
      body: updateProfileSchema,
    },
    handler: controller.updateMe,
  });

  fastify.post('/me/change-password', {
    schema: {
      tags: ['Profile'],
      summary: 'Change own account password',
      body: changePasswordSchema,
    },
    handler: controller.changePasswordMe,
  });

  fastify.post('/me/avatar', {
    schema: {
      tags: ['Profile'],
      summary: 'Update own profile avatar',
      body: {
        type: 'object',
        required: ['avatar'],
        properties: { avatar: { type: 'string' } },
      },
    },
    handler: controller.avatarMe,
  });
}

module.exports = userRoutes;
