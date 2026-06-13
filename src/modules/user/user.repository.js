'use strict';

const { User } = require('./user.model');
const { BaseRepository } = require('../../shared/base/BaseRepository');

// ---------------------------------------------------------------------------
// UserRepository
// Owner: Authentication & User Management
// ---------------------------------------------------------------------------

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  /**
   * Find a user by email (includes password for login).
   * @param {string} email
   * @returns {Promise<User|null>}
   */
  async findByEmailWithPassword(email) {
    return this.model.findOne({ email: email.toLowerCase(), isDeleted: false }).select('+password');
  }

  /**
   * Find a user by email.
   * @param {string} email
   * @returns {Promise<User|null>}
   */
  async findByEmail(email) {
    return this.findOne({ email: email.toLowerCase() });
  }

  /**
   * Find active users by role.
   * @param {string} roleId
   * @param {object} pagination
   * @returns {Promise<object>}
   */
  async findByRole(roleId, pagination = {}) {
    return this.paginate({ role: roleId, isActive: true }, pagination);
  }

  /**
   * Find a user by password reset token.
   * @param {string} token
   * @returns {Promise<User|null>}
   */
  async findByPasswordResetToken(token) {
    return this.model
      .findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() },
        isDeleted: false,
      })
      .select('+passwordResetToken +passwordResetExpires');
  }

  /**
   * Update last login info.
   * @param {string} userId
   * @param {string} ip
   * @returns {Promise<void>}
   */
  async updateLastLogin(userId, ip) {
    await this.model.updateOne(
      { _id: userId },
      {
        $set: { lastLoginAt: new Date(), lastLoginIp: ip },
        $inc: { loginCount: 1 },
      },
    );
  }

  /**
   * Track device login / session.
   * @param {string} userId
   * @param {object} deviceMeta
   */
  async trackDevice(userId, deviceMeta) {
    const { deviceId, deviceType, userAgent } = deviceMeta;
    // If device exists, update lastSeen, else push new device entry
    const exists = await this.model.exists({ _id: userId, 'devices.deviceId': deviceId });
    if (exists) {
      await this.model.updateOne(
        { _id: userId, 'devices.deviceId': deviceId },
        { $set: { 'devices.$.lastSeen': new Date() } }
      );
    } else {
      await this.model.updateOne(
        { _id: userId },
        {
          $push: {
            devices: {
              deviceId,
              deviceType,
              userAgent,
              lastSeen: new Date(),
            },
          },
        }
      );
    }
  }

  /**
   * Search users by name or email.
   * @param {string} query
   * @param {object} pagination
   */
  async search(query, pagination = {}) {
    const searchFilter = {
      $or: [
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ],
    };
    return this.paginate(searchFilter, pagination);
  }
}

module.exports = { UserRepository };
