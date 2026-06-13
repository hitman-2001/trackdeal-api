'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { AuthService } = require('./auth.service');

// ---------------------------------------------------------------------------
// AuthController — thin HTTP layer for authentication
// ---------------------------------------------------------------------------

class AuthController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.authService = deps.service || new AuthService(deps);
  }

  /**
   * GET /auth/invitations/validate
   */
  async validateInvitation(request, reply) {
    const { token } = request.query;
    const result = await this.authService.validateInvitation(token);
    return this.ok(reply, result, 'Invitation token is valid');
  }

  /**
   * POST /auth/invitations/accept
   */
  async acceptInvitation(request, reply) {
    const result = await this.authService.acceptInvitation(request.body);
    return this.created(reply, result, 'Invitation accepted successfully');
  }

  /**
   * POST /auth/login
   */
  async login(request, reply) {
    const meta = { ip: request.ip, userAgent: request.headers['user-agent'] };
    const result = await this.authService.login(request.body, meta);
    return this.ok(reply, result, 'Login successful');
  }

  /**
   * POST /auth/refresh
   */
  async refresh(request, reply) {
    const { refreshToken } = request.body;
    const meta = { ip: request.ip, userAgent: request.headers['user-agent'] };
    const result = await this.authService.refreshToken(refreshToken, meta);
    return this.ok(reply, result, 'Token refreshed successfully');
  }

  /**
   * POST /auth/logout
   */
  async logout(request, reply) {
    const { refreshToken } = request.body;
    const userId = this.getUserId(request);
    const meta = { ip: request.ip, userAgent: request.headers['user-agent'] };
    await this.authService.logout(refreshToken, userId, meta);
    return this.ok(reply, null, 'Logout successful');
  }

  /**
   * POST /auth/change-password
   */
  async changePassword(request, reply) {
    const { oldPassword, newPassword } = request.body;
    const userId = this.getUserId(request);
    const meta = { ip: request.ip, userAgent: request.headers['user-agent'] };
    await this.authService.changePassword(userId, oldPassword, newPassword, meta);
    return this.ok(reply, null, 'Password changed successfully');
  }

  /**
   * GET /auth/me
   */
  async me(request, reply) {
    const userId = this.getUserId(request);
    const user = await this.authService.getMe(userId);
    return this.ok(reply, user);
  }

  /**
   * POST /auth/forgot-password
   */
  async forgotPassword(request, reply) {
    await this.authService.forgotPassword(request.body.email);
    // Always return success to prevent email enumeration
    return this.ok(reply, null, 'If the email exists, a reset link has been sent');
  }

  /**
   * POST /auth/reset-password
   */
  async resetPassword(request, reply) {
    const { token, newPassword } = request.body;
    await this.authService.resetPassword(token, newPassword);
    return this.ok(reply, null, 'Password reset successfully');
  }
}

module.exports = { AuthController };
