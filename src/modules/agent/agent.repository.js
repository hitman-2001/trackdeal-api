'use strict';

const { BaseRepository } = require('../../shared/base/BaseRepository');
const { Agent } = require('./agent.model');

// ---------------------------------------------------------------------------
// AgentRepository — Data Access Layer
// ---------------------------------------------------------------------------

class AgentRepository extends BaseRepository {
  constructor() {
    super(Agent);
    this.isBranchScoped = false;
  }

  /**
   * Find existing agent with matching phone, email, or RERA number in organization.
   */
  async findDuplicate({ phone, email, reraNumber, excludeId = null }) {
    const conditions = [];

    if (phone) conditions.push({ phone });
    if (email) conditions.push({ email: email.toLowerCase() });
    if (reraNumber) conditions.push({ reraNumber });

    if (conditions.length === 0) return null;

    const filter = {
      isDeleted: { $ne: true },
      $or: conditions,
    };

    if (excludeId) {
      filter._id = { $ne: excludeId };
    }

    return this.findOne(filter);
  }
}

module.exports = { AgentRepository };
