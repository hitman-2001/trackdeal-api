'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { AuthService } = require('./auth.service');
const { loadEnv } = require('../../config/env.config');

function isNativeClient(request) {
  const origin = request?.headers?.origin || '';
  const clientPlatform = (request?.headers?.['x-client-platform'] || '').toLowerCase();
  return (
    clientPlatform === 'native' ||
    clientPlatform === 'android' ||
    clientPlatform === 'ios' ||
    origin.startsWith('capacitor://') ||
    origin === 'https://localhost' ||
    origin === 'http://localhost'
  );
}

function sessionCookieOptions(request) {
  const env = loadEnv();
  const origin = request?.headers?.origin || '';
  const isNative = isNativeClient(request);
  const isSecure =
    isNative ||
    env.NODE_ENV === 'production' ||
    env.SESSION_COOKIE_SECURE === true ||
    request?.protocol === 'https' ||
    origin.startsWith('https://');

  const maxAge = env.SESSION_COOKIE_MAX_AGE_SECONDS;

  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? 'none' : (env.SESSION_COOKIE_SAME_SITE || 'lax'),
    path: `${env.API_PREFIX}/auth`,
    maxAge,
    // Expires improves persistence compatibility with Android WebView cookie stores.
    expires: new Date(Date.now() + maxAge * 1000),
  };
}

function sendAuthenticatedSession(controller, request, reply, result, message) {
  if (!result?.refreshToken) {
    return controller.ok(reply, result, message);
  }

  const env = loadEnv();
  const { refreshToken, ...publicResult } = result;
  reply.setCookie(env.SESSION_COOKIE_NAME, refreshToken, sessionCookieOptions(request));
  reply.header('Cache-Control', 'no-store');

  return controller.ok(reply, publicResult, message);
}

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
    return sendAuthenticatedSession(this, request, reply, result, 'Login successful');
  }

  /**
   * POST /auth/mfa/verify
   */
  async verifyMfa(request, reply) {
    const meta = { ip: request.ip, userAgent: request.headers['user-agent'] };
    const result = await this.authService.verifyMfa(request.body, meta);
    return sendAuthenticatedSession(this, request, reply, result, 'MFA verification successful');
  }

  /**
   * POST /auth/mfa/resend
   */
  async resendMfa(request, reply) {
    const result = await this.authService.resendMfa(request.body);
    return this.ok(reply, result, 'Verification code resent successfully');
  }

  /**
   * POST /auth/refresh
   */
  async refresh(request, reply) {
    const env = loadEnv();
    const refreshToken =
      request.cookies?.[env.SESSION_COOKIE_NAME];
    const meta = { ip: request.ip, userAgent: request.headers['user-agent'] };
    try {
      const result = await this.authService.refreshToken(refreshToken, meta);
      const publicResult = { ...result };
      delete publicResult.refreshToken;
      reply.header('Cache-Control', 'no-store');
      return this.ok(reply, publicResult, 'Token refreshed successfully');
    } catch (error) {
      reply.clearCookie(env.SESSION_COOKIE_NAME, sessionCookieOptions(request));
      throw error;
    }
  }

  /**
   * POST /auth/logout
   */
  async logout(request, reply) {
    const env = loadEnv();
    const refreshToken =
      request.cookies?.[env.SESSION_COOKIE_NAME];
    const userId = this.getUserId(request);
    const meta = { ip: request.ip, userAgent: request.headers['user-agent'] };
    if (refreshToken) {
      await this.authService.logout(refreshToken, userId, meta);
    }
    reply.clearCookie(env.SESSION_COOKIE_NAME, sessionCookieOptions(request));
    reply.header('Cache-Control', 'no-store');
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
