'use strict';

// ---------------------------------------------------------------------------
// TokenService
// Decouples business logic services from framework-specific HTTP layer/decorators
// ---------------------------------------------------------------------------

class TokenService {
  /**
   * @param {object} deps
   * @param {object} deps.jwtSigner - Object wrapping token signing/verifications
   * @param {function} deps.jwtSigner.signAccess
   * @param {function} deps.jwtSigner.signRefresh
   * @param {function} deps.jwtSigner.verifyRefresh
   */
  constructor(deps = {}) {
    if (!deps.jwtSigner) {
      throw new Error('TokenService requires deps.jwtSigner');
    }
    this.jwtSigner = deps.jwtSigner;
  }

  /**
   * Sign an access token.
   * @param {object} payload
   * @returns {string}
   */
  signAccessToken(payload) {
    return this.jwtSigner.signAccess(payload);
  }

  /**
   * Sign a refresh token.
   * @param {object} payload
   * @returns {string}
   */
  signRefreshToken(payload) {
    return this.jwtSigner.signRefresh(payload);
  }

  /**
   * Verify and decode a refresh token.
   * @param {string} token
   * @returns {object} decoded payload
   */
  verifyRefreshToken(token) {
    return this.jwtSigner.verifyRefresh(token);
  }
}

module.exports = { TokenService };
