'use strict';

const { SystemSettings } = require('./settings.model');
const { BaseRepository } = require('../../shared/base/BaseRepository');

class SettingsRepository extends BaseRepository {
  constructor() { super(SystemSettings); }

  /**
   * Get the singleton settings document.
   * Creates it if it doesn't exist.
   */
  async getSettings() {
    let settings = await this.findOne({ key: 'system' });
    if (!settings) {
      settings = await this.create({ key: 'system', company: { name: 'Track Deal' } });
    }
    return settings;
  }

  /**
   * Update settings via upsert.
   */
  async updateSettings(data) {
    return this.model.findOneAndUpdate(
      { key: 'system' },
      { $set: data },
      { new: true, upsert: true },
    );
  }
}

module.exports = { SettingsRepository };
