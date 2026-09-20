'use strict';

const { BaseService } = require('../../shared/base/BaseService');
const { UserRepository } = require('../user/user.repository');
const { RefreshTokenRepository } = require('./refresh-token.repository');
const { UnauthorizedError, ConflictError, NotFoundError, ForbiddenError } = require('../../shared/errors');
const { AUDIT_ACTIONS, EVENTS } = require('../../shared/constants/app.constants');
const { tenantContext } = require('../../shared/context/tenant-context');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// AuthService — Decoupled Business Service Layer
// Handles: login, logout, token refresh, password change, reset, /me
// ---------------------------------------------------------------------------

class AuthService extends BaseService {
  /**
   * @param {object} deps
   * @param {TokenService} deps.tokenService - Decoupled JWT and cryptographic service
   */
  constructor(deps = {}) {
    super(deps);
    if (!deps.tokenService) {
      throw new Error('AuthService requires deps.tokenService');
    }
    this.userRepository = deps.userRepository || new UserRepository();
    this.refreshTokenRepository = deps.refreshTokenRepository || new RefreshTokenRepository();
    this.tokenService = deps.tokenService;
  }

  /**
   * Login — validate credentials and issue tokens with session tracking.
   * @param {object} credentials - { email, password, organization, tenant }
   * @param {object} meta        - { ip, userAgent }
   */
  async login(credentials, meta = {}) {
    const { email, password, organization, tenant } = credentials;
    const { isPlatformAdmin } = require('../tenant/tenant.constants');
    const mongoose = require('mongoose');

    const resolveRoleCode = async (userDoc) => {
      const roleRef = userDoc.roleId || userDoc.role;
      if (roleRef && typeof roleRef === 'object' && roleRef.code) return roleRef.code;
      if (roleRef) {
        const RoleModel = mongoose.model('Role');
        const roleDoc = await tenantContext.run({ isSystemOverride: true }, () =>
          RoleModel.findById(roleRef).select('code').lean()
        );
        return roleDoc?.code || null;
      }
      return null;
    };

    const orgInput = organization || tenant;
    let organizationDoc = null;
    let tenantDoc = null;
    let user;

    if (!orgInput || !String(orgInput).trim()) {
      user = await tenantContext.run({ isSystemOverride: true }, () =>
        this.userRepository.findByEmailWithPassword(email)
      );
      if (!user) {
        throw new UnauthorizedError('Invalid email or password');
      }
      const roleCode = await resolveRoleCode(user);
      if (!isPlatformAdmin(roleCode)) {
        throw new UnauthorizedError('Organization is required');
      }
    } else {
      const { findActiveOrganizationByInput } = require('../tenant/tenant.utils');
      organizationDoc = await tenantContext.run({ isSystemOverride: true }, () =>
        findActiveOrganizationByInput(orgInput)
      );

      if (!organizationDoc) {
        throw new UnauthorizedError('Invalid organization, email, or password');
      }

      user = await tenantContext.run({ isSystemOverride: true }, () =>
        this.userRepository.findByEmailWithPassword(email, {
          organizationId: organizationDoc._id,
        })
      );

      if (!user) {
        throw new UnauthorizedError('Invalid organization, email, or password');
      }

      const userOrgId = user.organizationId ? user.organizationId.toString() : null;
      if (userOrgId !== organizationDoc._id.toString()) {
        throw new UnauthorizedError('Invalid organization, email, or password');
      }
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Your account has been deactivated. Contact your administrator.');
    }

    // 2. Establish tenant execution context to safely perform updates and writes
    return tenantContext.run({
      tenantId: organizationDoc?.tenantId || tenantDoc?._id || user.tenantId || null,
      organizationId: organizationDoc?._id || user.organizationId,
      branchId: user.branchId,
    }, async () => {
      if (user.organizationId || organizationDoc) {
        const org = organizationDoc;
        if (org && org.status === 'suspended') {
          throw new ForbiddenError('Your organization has been suspended. Please contact TrackDeal support.');
        }
      }

      // Brute-force Lockout Check
      if (user.lockoutUntil && user.lockoutUntil > new Date()) {
        const remainingMinutes = Math.ceil((user.lockoutUntil - new Date()) / 1000 / 60);
        throw new ForbiddenError(
          `Account temporarily locked due to consecutive failed attempts. Try again in ${remainingMinutes} minutes.`
        );
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        // Increment login attempts for brute force tracking
        user.loginAttempts = (user.loginAttempts || 0) + 1;
        if (user.loginAttempts >= 5) {
          user.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15-minute lockout
          user.loginAttempts = 0; // reset counter
          await user.save();
          throw new ForbiddenError('Account locked due to consecutive failed attempts. Please try again in 15 minutes.');
        }
        await user.save();
        throw new UnauthorizedError('Invalid organization, email, or password');
      }

      // Success: Reset brute force lockout counters
      user.loginAttempts = 0;
      user.lockoutUntil = undefined;
      await user.save();

      // Build token payload and sign tokens
      const tokenPayload = await this._buildTokenPayload(user);
      const accessToken = this.tokenService.signAccessToken(tokenPayload);
      const refreshToken = this.tokenService.signRefreshToken({ id: user.id });

      // Track device and last login info
      const deviceMeta = this._parseUserAgent(meta.userAgent);
      await this.userRepository.trackDevice(user.id, deviceMeta);
      await this.userRepository.updateLastLogin(user.id, meta.ip);

      // Save hashed refresh token to DB
      const tokenHash = this._hashToken(refreshToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await this.refreshTokenRepository.create({
        token: tokenHash,
        user: user.id,
        device: deviceMeta.deviceType,
        ip: meta.ip,
        expiresAt,
      });

      // Publish event
      await this.publishEvent(EVENTS.USER_LOGGED_IN, {
        userId: user.id,
        email: user.email,
        ip: meta.ip,
      });

      // Audit
      await this.logAudit({
        action: AUDIT_ACTIONS.LOGIN,
        entity: 'User',
        entityId: user.id,
        userId: user.id,
        description: `User '${user.email}' logged in successfully`,
        requestMetadata: meta,
      });

      const sanitizedUser = this._sanitizeUser(user);
      sanitizedUser.role = tokenPayload.role;
      sanitizedUser.permissions = tokenPayload.permissions;
      sanitizedUser.organizationType = tokenPayload.organizationType;
      sanitizedUser.tenantId = tokenPayload.tenantId;
      sanitizedUser.tenantSlug = tokenPayload.tenantSlug;
      sanitizedUser.tenantDomain = tokenPayload.tenantDomain;
      sanitizedUser.tenantVertical = tokenPayload.tenantVertical || tokenPayload.tenantDomain;
      sanitizedUser.enabledModules = tokenPayload.enabledModules;
      sanitizedUser.featuresFlags = tokenPayload.featuresFlags;
      sanitizedUser.forcePasswordChange = !!user.forcePasswordChange;

      return {
        accessToken,
        refreshToken,
        user: sanitizedUser,
      };
    });
  }

  /**
   * Refresh token pair with active session verification and Token Reuse Detection.
   * @param {string} token - Raw refresh token
   * @param {object} meta  - { ip, userAgent }
   * @returns {{ accessToken, refreshToken }}
   */
  async refreshToken(token, meta = {}) {
    let decoded;
    try {
      decoded = this.tokenService.verifyRefreshToken(token);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token. Please log in again.');
    }

    // System bypass to fetch the user and token context securely across tenant namespaces
    return tenantContext.run({ isSystemOverride: true }, async () => {
      const tokenHash = this._hashToken(token);
      const storedToken = await this.refreshTokenRepository.findByToken(tokenHash);

      if (!storedToken) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Token Reuse Detection (Replay Hack Attempt Mitigation)
      if (storedToken.isUsed || storedToken.isRevoked) {
        // Invalidate all active sessions for this compromised user immediately
        await this.refreshTokenRepository.revokeAllForUser(storedToken.user._id);

        await this.logAudit({
          action: AUDIT_ACTIONS.SECURITY_ALERT,
          entity: 'User',
          entityId: storedToken.user._id,
          userId: storedToken.user._id,
          description: `Security Warning: Refresh token reuse detected! All user sessions revoked.`,
          requestMetadata: meta,
        });

        throw new UnauthorizedError('Security Warning: Session hijacked. All user sessions have been terminated.');
      }

      if (storedToken.expiresAt < new Date()) {
        throw new UnauthorizedError('Refresh token has expired. Please log in again.');
      }

      const user = storedToken.user;
      if (!user || !user.isActive) {
        throw new UnauthorizedError('User not found or inactive');
      }

      // Establish target organization context for rotation execution
      return tenantContext.run({
        tenantId: user.tenantId,
        organizationId: user.organizationId,
        branchId: user.branchId,
      }, async () => {
        // Rotate token! Mark old as used
        storedToken.isUsed = true;

        const tokenPayload = await this._buildTokenPayload(user);
        const newAccessToken = this.tokenService.signAccessToken(tokenPayload);
        const newRefreshToken = this.tokenService.signRefreshToken({ id: user.id });
        const newHash = this._hashToken(newRefreshToken);

        storedToken.replacedByToken = newHash;
        await storedToken.save();

        // Create the new refresh token in DB
        const deviceMeta = this._parseUserAgent(meta.userAgent);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await this.refreshTokenRepository.create({
          token: newHash,
          user: user._id,
          device: deviceMeta.deviceType,
          ip: meta.ip || storedToken.ip,
          expiresAt,
        });

        return {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          user: this._sanitizeUser(user),
        };
      });
    });
  }

  /**
   * Logout — invalidate the active session.
   */
  async logout(token, userId, meta = {}) {
    const tokenHash = this._hashToken(token);
    
    // We already run in verified tenant context via middleware
    const storedToken = await this.refreshTokenRepository.findOne({ token: tokenHash });
    if (storedToken) {
      storedToken.isRevoked = true;
      await storedToken.save();
    }

    // Publish event
    await this.publishEvent(EVENTS.USER_LOGGED_OUT, {
      userId,
      ip: meta.ip,
    });

    // Audit
    await this.logAudit({
      action: AUDIT_ACTIONS.LOGOUT,
      entity: 'User',
      entityId: userId,
      userId,
      description: 'User logged out successfully',
      requestMetadata: meta,
    });
  }

  /**
   * Change user password securely.
   */
  async changePassword(userId, oldPassword, newPassword, meta = {}) {
    // 1. Fetch user securely under tenant context
    const user = await this.userRepository.model.findById(userId).select('+password');
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    // 2. Verify old password
    const isValidPassword = await bcrypt.compare(oldPassword, user.password);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid old password');
    }

    // 3. Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    user.forcePasswordChange = false;
    user.passwordChangedAt = new Date();
    await user.save();

    // 4. Revoke all active sessions (refresh tokens) globally for security
    await this.refreshTokenRepository.revokeAllForUser(userId);

    // Audit
    await this.logAudit({
      action: AUDIT_ACTIONS.PASSWORD_CHANGED,
      entity: 'User',
      entityId: userId,
      userId,
      description: 'User changed password successfully. All active sessions revoked.',
      requestMetadata: meta,
    });
  }

  /**
   * Get the currently authenticated user.
   */
  async getMe(userId) {
    const user = await this.userRepository.findById(userId, null, {
      populate: { path: 'role', select: 'name permissions' },
    });

    if (!user) throw new UnauthorizedError('User not found');
    const sanitized = this._sanitizeUser(user);
    const tokenPayload = await this._buildTokenPayload(user);
    sanitized.role = tokenPayload.role;
    sanitized.permissions = tokenPayload.permissions;
    sanitized.organizationType = tokenPayload.organizationType;
    sanitized.tenantId = tokenPayload.tenantId;
    sanitized.tenantSlug = tokenPayload.tenantSlug;
    sanitized.tenantDomain = tokenPayload.tenantDomain;
    sanitized.tenantVertical = tokenPayload.tenantVertical || tokenPayload.tenantDomain;
    sanitized.enabledModules = tokenPayload.enabledModules;
    sanitized.featuresFlags = tokenPayload.featuresFlags;
    return sanitized;
  }

  /**
   * Initiate password reset.
   */
  async forgotPassword(email) {
    const user = await tenantContext.run({ isSystemOverride: true }, () =>
      this.userRepository.findByEmail(email)
    );

    // Always respond success to prevent email enumeration
    if (!user) return;

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await tenantContext.run({ organizationId: user.organizationId }, async () => {
      await this.userRepository.update(user.id, {
        passwordResetToken: resetToken,
        passwordResetExpires: tokenExpiry,
      });

      await this.publishEvent(EVENTS.PASSWORD_RESET, {
        userId: user.id,
        email: user.email,
        resetToken,
      });
    });
  }

  /**
   * Reset password using a valid reset token.
   */
  async resetPassword(token, newPassword) {
    const user = await tenantContext.run({ isSystemOverride: true }, () =>
      this.userRepository.findByPasswordResetToken(token)
    );

    if (!user) {
      throw new UnauthorizedError('Invalid or expired password reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await tenantContext.run({ organizationId: user.organizationId }, async () => {
      await this.userRepository.update(user.id, {
        password: hashedPassword,
        passwordResetToken: undefined,
        passwordResetExpires: undefined,
        passwordChangedAt: new Date(),
      });

      // Revoke all sessions
      await this.refreshTokenRepository.revokeAllForUser(user.id);

      await this.logAudit({
        action: AUDIT_ACTIONS.PASSWORD_RESET,
        entity: 'User',
        entityId: user.id,
        userId: user.id,
        description: `Password reset for '${user.email}'`,
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  _hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  _parseUserAgent(userAgent = '') {
    const ua = userAgent.toLowerCase();
    let deviceType = 'web';

    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      deviceType = 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad') || ua.includes('playbook')) {
      deviceType = 'tablet';
    }

    return {
      deviceType,
      userAgent,
      deviceId: crypto.createHash('md5').update(userAgent).digest('hex'),
    };
  }

  async _buildTokenPayload(user) {
    let roleRef = user.roleId || user.role;
    let roleDoc = null;
    if (roleRef && (typeof roleRef === 'string' || roleRef instanceof require('mongoose').Types.ObjectId)) {
      const RoleModel = require('mongoose').model('Role');
      roleDoc = await tenantContext.run({ isSystemOverride: true }, () => RoleModel.findById(roleRef));
    } else if (roleRef && typeof roleRef === 'object' && roleRef.code) {
      roleDoc = roleRef;
    }

    const roleName = roleDoc?.code || roleDoc?.name || 'guest';
    const rolePermissions = roleDoc?.permissions || [];

    const added = user.permissionOverrides?.added || [];
    const removed = user.permissionOverrides?.removed || [];

    const permissionsSet = new Set([...rolePermissions, ...added]);
    removed.forEach((p) => permissionsSet.delete(p));

    // Fetch organization to get the organizationType for the JWT payload.
    // This is done once at login/refresh and baked into the JWT, so no
    // per-request DB lookups are required for tier-based feature gating.
    let organizationType = 'AGENCY'; // safe fallback
    let tenantId = user.tenantId || null;
    let tenantSlug = null;
    let tenantDomain = 'realEstate';
    let enabledModules = [];
    let featuresFlags = {};
    let orgVertical = null;
    if (user.organizationId && require('mongoose').Types.ObjectId.isValid(user.organizationId)) {
      const { Organization } = require('../organization/organization.model');
      const org = await tenantContext.run({ isSystemOverride: true }, () =>
        Organization.findById(user.organizationId).select('organizationType tenantId vertical').lean()
      );
      if (org?.organizationType) {
        organizationType = org.organizationType;
      }
      if (!tenantId && org?.tenantId) {
        tenantId = org.tenantId;
      }
      if (org?.vertical) {
        orgVertical = org.vertical;
      }
    }

    const { modulesToFeatureFlags, moduleKeysForVertical, normalizeVertical } = require('../tenant/tenant.constants');
    if (tenantId) {
      const { Tenant } = require('../tenant/tenant.model');
      const tenantDoc = await tenantContext.run({ isSystemOverride: true }, () =>
        Tenant.findById(tenantId).select('slug domain enabledModules').lean()
      );
      if (tenantDoc) {
        tenantSlug = tenantDoc.slug;
        tenantDomain = orgVertical || tenantDoc.domain || 'realEstate';
        enabledModules = Array.isArray(tenantDoc.enabledModules) && tenantDoc.enabledModules.length
          ? tenantDoc.enabledModules
          : moduleKeysForVertical(tenantDomain);
        featuresFlags = modulesToFeatureFlags(enabledModules, tenantDomain);
      }
    }

    if (orgVertical) {
      tenantDomain = normalizeVertical(orgVertical);
      enabledModules = moduleKeysForVertical(tenantDomain);
      featuresFlags = modulesToFeatureFlags(enabledModules, tenantDomain);
    }

    const { isPlatformAdmin } = require('../tenant/tenant.constants');
    const permissions = isPlatformAdmin(roleName)
      ? ['*', ...Array.from(permissionsSet)]
      : Array.from(permissionsSet);

    return {
      id: user.id,
      email: user.email,
      role: roleName,
      permissions,
      permissionsVersion: Number(user.permissionsVersion || 0),
      firstName: user.firstName,
      lastName: user.lastName,
      tenantId,
      tenantSlug,
      tenantDomain,
      tenantVertical: tenantDomain,
      enabledModules,
      featuresFlags,
      organizationId: user.organizationId,
      organizationType,
      branchId: user.branchId,
    };
  }

  /**
   * Validate a pending invitation token.
   */
  async validateInvitation(rawToken) {
    const crypto = require('crypto');
    const { UserInvitation } = require('../user/user-invitation.model');
    const { Organization } = require('../organization/organization.model');
    const { Role } = require('../authorization/role.model');
    const { Branch } = require('../branch/branch.model');
    const { BusinessRuleError } = require('../../shared/errors');

    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    const invite = await tenantContext.run({ isSystemOverride: true }, () =>
      UserInvitation.findOne({
        invitationToken: hashedToken,
        status: 'pending',
        expiresAt: { $gt: new Date() },
      })
    );

    if (!invite) {
      throw new BusinessRuleError('Invitation token is invalid, cancelled, or expired.', 'INVITATION_INVALID');
    }

    const org = await tenantContext.run({ isSystemOverride: true }, () =>
      Organization.findById(invite.organizationId).select('name').lean()
    );

    const role = await tenantContext.run({ isSystemOverride: true }, () =>
      Role.findById(invite.roleId).select('name').lean()
    );

    let branchName = null;
    if (invite.branchId) {
      const branch = await tenantContext.run({ isSystemOverride: true }, () =>
        Branch.findById(invite.branchId).select('name').lean()
      );
      branchName = branch?.name || null;
    }

    return {
      orgName: org?.name || 'Organization Tenant',
      role: role?.name || 'User',
      branch: branchName,
    };
  }

  /**
   * Accept invitation, set password and create user account.
   */
  async acceptInvitation(data) {
    const crypto = require('crypto');
    const mongoose = require('mongoose');
    const { UserInvitation } = require('../user/user-invitation.model');
    const { ConflictError, BusinessRuleError } = require('../../shared/errors');
    const User = mongoose.model('User');

    const hashedToken = crypto.createHash('sha256').update(data.invitationToken).digest('hex');

    const invite = await tenantContext.run({ isSystemOverride: true }, () =>
      UserInvitation.findOne({
        invitationToken: hashedToken,
        status: 'pending',
        expiresAt: { $gt: new Date() },
      })
    );

    if (!invite) {
      throw new BusinessRuleError('Invitation token is invalid, cancelled, or expired.', 'INVITATION_INVALID');
    }

    // Check user uniqueness
    const exists = await tenantContext.run({ isSystemOverride: true }, () =>
      User.findOne({ email: invite.email, isDeleted: false })
    );
    if (exists) {
      throw new ConflictError('A user with this email already exists on the platform.');
    }

    // Verify organization quota before creating user
    const { Organization } = require('../organization/organization.model');
    const org = await tenantContext.run({ isSystemOverride: true }, () =>
      Organization.findById(invite.organizationId)
    );
    if (!org || org.isDeleted) {
      throw new BusinessRuleError('Organization not found or inactive.', 'ORGANIZATION_INACTIVE');
    }
    const quota = org.maxUsers || org.subscription?.maxUsers || 10;
    const currentActiveUsers = await tenantContext.run({ isSystemOverride: true }, () =>
      User.countDocuments({ organizationId: org._id, isDeleted: false })
    );
    if (currentActiveUsers >= quota) {
      throw new BusinessRuleError(
        `Organization '${org.name}' has reached its maximum user quota (${quota} users). Please contact your administrator.`,
        'QUOTA_EXCEEDED'
      );
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    let session = null;
    let useTransaction = true;
    try {
      if (mongoose.connection.readyState === 1) {
        session = await mongoose.startSession();
        session.startTransaction();
      } else {
        useTransaction = false;
      }
    } catch (e) {
      useTransaction = false;
    }

    let user;
    try {
      // Create user inside bypass context since actor is the new invited user (non-authenticated at register)
      const userList = await tenantContext.run({ isSystemOverride: true }, () =>
        User.create([{
          firstName: invite.email.split('@')[0], // Default name
          lastName: 'User',
          email: invite.email,
          password: hashedPassword,
          tenantId: invite.tenantId || null,
          organizationId: invite.organizationId,
          branchId: invite.branchId,
          roleId: invite.roleId,
          status: 'active',
        }], useTransaction ? { session } : {})
      );

      user = userList[0];

      // Update invite status
      await tenantContext.run({ isSystemOverride: true }, () =>
        UserInvitation.updateOne(
          { _id: invite.id },
          { $set: { status: 'accepted' } },
          useTransaction ? { session } : {}
        )
      );

      // If the role being accepted is org_admin, assign Organization.ownerId = user._id
      const { Role } = require('../authorization/role.model');
      const role = await tenantContext.run({ isSystemOverride: true }, () =>
        Role.findById(invite.roleId).select('code').lean()
      );
      if (role?.code === 'org_admin') {
        const { Organization } = require('../organization/organization.model');
        await tenantContext.run({ isSystemOverride: true }, () =>
          Organization.updateOne(
            { _id: invite.organizationId },
            { $set: { ownerId: user._id } },
            useTransaction ? { session } : {}
          )
        );
      }

      if (useTransaction && session) {
        await session.commitTransaction();
      }
    } catch (err) {
      if (useTransaction && session) {
        await session.abortTransaction();
      }
      throw err;
    } finally {
      if (useTransaction && session) {
        session.endSession();
      }
    }

    const { AUDIT_ACTIONS } = require('../../shared/constants/app.constants');
    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'UserInvitation',
      entityId: invite.id,
      userId: user.id,
      organizationId: invite.organizationId,
      description: `Accepted invitation for '${invite.email}'`,
    });

    return this._sanitizeUser(user);
  }

  _sanitizeUser(user) {
    const obj = user.toJSON ? user.toJSON() : { ...user };
    delete obj.password;
    delete obj.passwordResetToken;
    delete obj.passwordResetExpires;
    return obj;
  }
}

module.exports = { AuthService };
