'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { EducationService } = require('./education.service');

class EducationController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.educationService = deps.educationService || new EducationService(deps);
  }

  async summary(request, reply) {
    const data = await this.educationService.getSummary(this.getUser(request));
    return this.ok(reply, data);
  }

  async analytics(request, reply) {
    const data = await this.educationService.getAnalytics(request.query, this.getUser(request));
    return this.ok(reply, data);
  }

  async listClasses(request, reply) {
    const query = this.getPagination(request.query);
    const result = await this.educationService.listClasses({ ...request.query, ...query }, this.getUser(request));
    return this.paginated(reply, result.data, result.pagination);
  }

  async createClass(request, reply) {
    const item = await this.educationService.createClass(request.body, this.getUser(request));
    return this.created(reply, item, 'Class created successfully');
  }

  async updateClass(request, reply) {
    const item = await this.educationService.updateClass(request.params.id, request.body, this.getUser(request));
    return this.ok(reply, item, 'Class updated successfully');
  }

  async removeClass(request, reply) {
    await this.educationService.removeClass(request.params.id, this.getUser(request));
    return this.noContent(reply);
  }

  async listStudents(request, reply) {
    const query = this.getPagination(request.query);
    const result = await this.educationService.listStudents({ ...request.query, ...query }, this.getUser(request));
    return this.paginated(reply, result.data, result.pagination);
  }

  async createStudent(request, reply) {
    const item = await this.educationService.createStudent(request.body, this.getUser(request));
    return this.created(reply, item, 'Student created successfully');
  }

  async updateStudent(request, reply) {
    const item = await this.educationService.updateStudent(request.params.id, request.body, this.getUser(request));
    return this.ok(reply, item, 'Student updated successfully');
  }

  async removeStudent(request, reply) {
    await this.educationService.removeStudent(request.params.id, this.getUser(request));
    return this.noContent(reply);
  }

  async getLead(request, reply) {
    const item = await this.educationService.getLead(request.params.id, this.getUser(request));
    return this.ok(reply, item);
  }

  async listLeads(request, reply) {
    const query = this.getPagination(request.query);
    const result = await this.educationService.listLeads({ ...request.query, ...query }, this.getUser(request));
    return this.paginated(reply, result.data, result.pagination);
  }

  async createLead(request, reply) {
    const item = await this.educationService.createLead(request.body, this.getUser(request));
    return this.created(reply, item, 'Student lead created successfully');
  }

  async updateLead(request, reply) {
    const item = await this.educationService.updateLead(request.params.id, request.body, this.getUser(request));
    return this.ok(reply, item, 'Student lead updated successfully');
  }

  async enrollLead(request, reply) {
    const student = await this.educationService.enrollLead(request.params.id, request.body || {}, this.getUser(request));
    return this.ok(reply, student, 'Student enrolled successfully');
  }
}

module.exports = { EducationController };
