'use strict';

const { UserInvitation } = require('./user-invitation.model');
const { BaseRepository } = require('../../shared/base/BaseRepository');

// ---------------------------------------------------------------------------
// UserInvitationRepository — Owner: User Management Module
// ---------------------------------------------------------------------------

class UserInvitationRepository extends BaseRepository {
  constructor() {
    super(UserInvitation);
    this.isTenantScoped = true; // Invitation tokens are strictly organization-scoped
  }

  /**
   * Find an active pending invitation by email.
   * @param {string} email
   * @returns {Promise<UserInvitation|null>}
   */
  async findPendingByEmail(email) {
    return this.findOne({ email: email.toLowerCase().trim(), status: 'pending' });
  }

  /**
   * Find an active invitation by token.
   * @param {string} token
   * @returns {Promise<UserInvitation|null>}
   */
  async findByToken(token) {
    return this.findOne({ invitationToken: token });
  }
}

module.exports = { UserInvitationRepository };
