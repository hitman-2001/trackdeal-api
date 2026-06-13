'use strict';

const { RefreshToken } = require('./refresh-token.model');
const { BaseRepository } = require('../../shared/base/BaseRepository');

// ---------------------------------------------------------------------------
// RefreshTokenRepository
// Owner: Authentication Module
// ---------------------------------------------------------------------------

class RefreshTokenRepository extends BaseRepository {
  constructor() {
    super(RefreshToken);
  }

  /**
   * Find a refresh token by its SHA-256 hash.
   * Includes user population.
   * @param {string} tokenHash
   * @returns {Promise<RefreshToken|null>}
   */
  async findByToken(tokenHash) {
    return this.model.findOne({ token: tokenHash }).populate('user');
  }

  /**
   * Revoke all active refresh tokens for a specific user.
   * Sets isRevoked to true.
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async revokeAllForUser(userId) {
    return this.model.updateMany(
      { user: userId, isRevoked: false, isUsed: false },
      { $set: { isRevoked: true } }
    );
  }

  /**
   * Delete all expired refresh tokens from the database.
   * Runs in the background to clean up storage.
   * @returns {Promise<object>}
   */
  async deleteExpired() {
    return this.model.deleteMany({ expiresAt: { $lt: new Date() } });
  }
}

module.exports = { RefreshTokenRepository };
