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

  async teamActivity(request, reply) {
    const data = await this.educationService.getTeamActivity(this.getUser(request));
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
    if (request.query.limit === 'all') query.limit = 'all';
    const result = await this.educationService.listStudents({ ...request.query, ...query }, this.getUser(request));
    return this.paginated(reply, result.data, result.pagination);
  }

  async listStudentSchools(request, reply) {
    const schools = await this.educationService.listStudentSchools(this.getUser(request));
    return this.ok(reply, schools);
  }

  async listLeadSelection(request, reply) {
    const leads = await this.educationService.listLeads(request.query, this.getUser(request), { selectionOnly: true });
    return this.ok(reply, leads);
  }

  async listLeadSchools(request, reply) {
    const schools = await this.educationService.listLeadSchools(this.getUser(request));
    return this.ok(reply, schools);
  }

  async createStudent(request, reply) {
    const item = await this.educationService.createStudent(request.body, this.getUser(request));
    return this.created(reply, item, 'Student created successfully');
  }

  async importStudentsBulk(request, reply) {
    const result = await this.educationService.importStudentsBulk(request.body.rows, this.getUser(request));
    return this.ok(reply, result, `Imported ${result.importedCount} student(s)`);
  }

  async updateStudent(request, reply) {
    const item = await this.educationService.updateStudent(request.params.id, request.body, this.getUser(request));
    return this.ok(reply, item, 'Student updated successfully');
  }

  async removeStudentsBulk(request, reply) {
    const { ids } = request.body || {};
    const result = await this.educationService.removeStudentsBulk(ids, this.getUser(request));
    return this.ok(reply, result, `${result.deletedCount} student(s) deleted successfully`);
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
    if (request.query.limit === 'all') query.limit = 'all';
    const result = await this.educationService.listLeads({ ...request.query, ...query }, this.getUser(request));
    return this.paginated(reply, result.data, result.pagination);
  }

  async createLead(request, reply) {
    const item = await this.educationService.createLead(request.body, this.getUser(request));
    return this.created(reply, item, 'Student lead created successfully');
  }

  async importLeadsBulk(request, reply) {
    const result = await this.educationService.importLeadsBulk(request.body.rows, this.getUser(request));
    return this.ok(reply, result, `Imported ${result.importedCount} student lead(s)`);
  }

  async updateLead(request, reply) {
    const item = await this.educationService.updateLead(request.params.id, request.body, this.getUser(request));
    return this.ok(reply, item, 'Student lead updated successfully');
  }

  async removeLeadsBulk(request, reply) {
    const result = await this.educationService.removeLeadsBulk(request.body.ids, this.getUser(request));
    return this.ok(reply, result, `${result.deletedCount} student lead(s) deleted successfully`);
  }

  async removeLead(request, reply) {
    await this.educationService.removeLead(request.params.id, this.getUser(request));
    return this.noContent(reply);
  }

  async checkActiveTasks(request, reply) {
    const result = await this.educationService.checkHasActiveTasks(request.params.id);
    return this.ok(reply, result);
  }

  async enrollLead(request, reply) {
    const student = await this.educationService.enrollLead(request.params.id, request.body || {}, this.getUser(request));
    return this.ok(reply, student, 'Student enrolled successfully');
  }

  async distributeBatchRoundRobin(request, reply) {
    const result = await this.educationService.distributeLeadsBatchRoundRobin(
      request.body,
      this.getUser(request)
    );
    const message =
      result.mode === "equal"
        ? `Student leads distributed equally among ${result.staffCount} staff members`
        : `Student leads distributed successfully in fixed batches of ${result.batchSize}`;
    return this.ok(
      reply,
      result,
      message
    );
  }

  async checkDuplicates(request, reply) {
    const isStudents = request.url?.includes('/students/');
    const result = await this.educationService.checkDuplicates(
      { ...request.body, target: isStudents ? 'students' : 'leads' },
      this.getUser(request)
    );
    return this.ok(reply, result);
  }
}

module.exports = { EducationController };
