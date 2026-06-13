'use strict';

const { BaseService } = require('../../shared/base/BaseService');
const { SettingsRepository } = require('./settings.repository');
const { AUDIT_ACTIONS } = require('../../shared/constants/app.constants');

class SettingsService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.settingsRepository = deps.settingsRepository || new SettingsRepository();
  }

  async getSettings() { return this.settingsRepository.getSettings(); }

  async updateCompanySettings(data, actor) {
    const updated = await this.settingsRepository.updateSettings({ company: data });
    await this.logAudit({ action: AUDIT_ACTIONS.UPDATE, entity: 'SystemSettings', entityId: 'system', userId: actor.id, newValues: { company: data } });
    return updated;
  }

  async updateCRMSettings(data, actor) {
    return this.settingsRepository.updateSettings({ crm: data });
  }

  async updateWorkflowSettings(data, actor) {
    return this.settingsRepository.updateSettings({ workflow: data });
  }

  async updateNotificationSettings(data, actor) {
    return this.settingsRepository.updateSettings({ notifications: data });
  }

  async updateInvoiceSettings(data, actor) {
    return this.settingsRepository.updateSettings({ invoice: data });
  }
}

module.exports = { SettingsService };
