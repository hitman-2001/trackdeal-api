'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { SettingsService } = require('./settings.service');

class SettingsController extends BaseController {
  constructor(deps = {}) { super(deps); this.settingsService = deps.service || new SettingsService(deps); }
  async get(req, reply) { return this.ok(reply, await this.settingsService.getSettings()); }
  async updateCompany(req, reply) { return this.ok(reply, await this.settingsService.updateCompanySettings(req.body, this.getUser(req))); }
  async updateCRM(req, reply) { return this.ok(reply, await this.settingsService.updateCRMSettings(req.body, this.getUser(req))); }
  async updateWorkflow(req, reply) { return this.ok(reply, await this.settingsService.updateWorkflowSettings(req.body, this.getUser(req))); }
  async updateNotifications(req, reply) { return this.ok(reply, await this.settingsService.updateNotificationSettings(req.body, this.getUser(req))); }
}

module.exports = { SettingsController };
