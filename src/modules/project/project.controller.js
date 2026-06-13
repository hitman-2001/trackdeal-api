"use strict";

const { BaseController } = require("../../shared/base/BaseController");
const { ProjectService } = require("./project.service");

class ProjectController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.projectService = deps.service || new ProjectService(deps);
  }

  // ---------------------------------------------------------------------------
  // 1. Builder Controller Methods
  // ---------------------------------------------------------------------------

  async listBuilders(request, reply) {
    const query = this.getPagination(request.query);
    const { data, pagination } = await this.projectService.builderRepository.paginate(
      { isDeleted: false, ...request.query },
      { ...query }
    );
    return this.paginated(reply, data, pagination);
  }

  async getBuilderById(request, reply) {
    const builder = await this.projectService.builderRepository.findByIdOrFail(
      request.params.id,
      "Builder"
    );
    return this.ok(reply, builder);
  }

  async createBuilder(request, reply) {
    const builder = await this.projectService.createBuilder(
      request.body,
      this.getUser(request)
    );
    return this.created(reply, builder, "Builder created successfully");
  }

  async updateBuilder(request, reply) {
    const builder = await this.projectService.updateBuilder(
      request.params.id,
      request.body,
      this.getUser(request)
    );
    return this.ok(reply, builder, "Builder updated successfully");
  }

  async removeBuilder(request, reply) {
    await this.projectService.archiveBuilder(request.params.id, this.getUser(request));
    return this.noContent(reply);
  }

  // ---------------------------------------------------------------------------
  // 2. Amenity Controller Methods
  // ---------------------------------------------------------------------------

  async listAmenities(request, reply) {
    const query = this.getPagination(request.query);
    const { data, pagination } = await this.projectService.amenityRepository.paginate(
      { isDeleted: false, ...request.query },
      { ...query }
    );
    return this.paginated(reply, data, pagination);
  }

  async getAmenityById(request, reply) {
    const amenity = await this.projectService.amenityRepository.findByIdOrFail(
      request.params.id,
      "Amenity"
    );
    return this.ok(reply, amenity);
  }

  async createAmenity(request, reply) {
    const amenity = await this.projectService.createAmenity(
      request.body,
      this.getUser(request)
    );
    return this.created(reply, amenity, "Amenity created successfully");
  }

  async updateAmenity(request, reply) {
    const amenity = await this.projectService.updateAmenity(
      request.params.id,
      request.body,
      this.getUser(request)
    );
    return this.ok(reply, amenity, "Amenity updated successfully");
  }

  async removeAmenity(request, reply) {
    await this.projectService.archiveAmenity(request.params.id, this.getUser(request));
    return this.noContent(reply);
  }

  // ---------------------------------------------------------------------------
  // 3. Project Controller Methods
  // ---------------------------------------------------------------------------

  async listProjects(request, reply) {
    const query = this.getPagination(request.query);
    const { data, pagination } = await this.projectService.projectRepository.paginate(
      { isDeleted: false, ...request.query },
      { ...query, populate: [{ path: "builderId", select: "name code" }] }
    );
    return this.paginated(reply, data, pagination);
  }

  async getProjectById(request, reply) {
    const project = await this.projectService.projectRepository.findByIdOrFail(
      request.params.id,
      "Project"
    );
    return this.ok(reply, project);
  }

  async createProject(request, reply) {
    const project = await this.projectService.createProject(
      request.body,
      this.getUser(request)
    );
    return this.created(reply, project, "Project created successfully");
  }

  async updateProject(request, reply) {
    const project = await this.projectService.updateProject(
      request.params.id,
      request.body,
      this.getUser(request)
    );
    return this.ok(reply, project, "Project updated successfully");
  }

  async removeProject(request, reply) {
    await this.projectService.archiveProject(request.params.id, this.getUser(request));
    return this.noContent(reply);
  }

  // ---------------------------------------------------------------------------
  // 4. Tower Controller Methods
  // ---------------------------------------------------------------------------

  async listTowers(request, reply) {
    const query = this.getPagination(request.query);
    const { data, pagination } = await this.projectService.towerRepository.paginate(
      { isDeleted: false, ...request.query },
      { ...query }
    );
    return this.paginated(reply, data, pagination);
  }

  async getTowerById(request, reply) {
    const tower = await this.projectService.towerRepository.findByIdOrFail(
      request.params.id,
      "Tower"
    );
    return this.ok(reply, tower);
  }

  async createTower(request, reply) {
    const tower = await this.projectService.createTower(
      request.body,
      this.getUser(request)
    );
    return this.created(reply, tower, "Tower created successfully");
  }

  async updateTower(request, reply) {
    const tower = await this.projectService.updateTower(
      request.params.id,
      request.body,
      this.getUser(request)
    );
    return this.ok(reply, tower, "Tower updated successfully");
  }

  // ---------------------------------------------------------------------------
  // 5. Unit Controller Methods
  // ---------------------------------------------------------------------------

  async listUnits(request, reply) {
    const query = this.getPagination(request.query);
    const { data, pagination } = await this.projectService.unitRepository.paginate(
      { isDeleted: false, ...request.query },
      { ...query, populate: [{ path: "projectId", select: "name" }, { path: "towerId", select: "name" }] }
    );
    return this.paginated(reply, data, pagination);
  }

  async getUnitById(request, reply) {
    const unit = await this.projectService.unitRepository.findByIdOrFail(
      request.params.id,
      "Unit"
    );
    return this.ok(reply, unit);
  }

  async createUnit(request, reply) {
    const unit = await this.projectService.createUnit(
      request.body,
      this.getUser(request)
    );
    return this.created(reply, unit, "Unit created successfully");
  }

  async updateUnit(request, reply) {
    const unit = await this.projectService.updateUnit(
      request.params.id,
      request.body,
      this.getUser(request)
    );
    return this.ok(reply, unit, "Unit updated successfully");
  }

  async blockUnit(request, reply) {
    const unit = await this.projectService.blockUnit(
      request.params.id,
      request.body,
      this.getUser(request)
    );
    return this.ok(reply, unit, "Unit blocked successfully");
  }

  async reserveUnit(request, reply) {
    const unit = await this.projectService.reserveUnit(
      request.params.id,
      request.body,
      this.getUser(request)
    );
    return this.ok(reply, unit, "Unit reserved successfully");
  }

  async markUnitSold(request, reply) {
    const unit = await this.projectService.markUnitSold(
      request.params.id,
      request.body,
      this.getUser(request)
    );
    return this.ok(reply, unit, "Unit marked as sold successfully");
  }

  async releaseUnit(request, reply) {
    const unit = await this.projectService.releaseUnit(
      request.params.id,
      this.getUser(request)
    );
    return this.ok(reply, unit, "Unit released successfully");
  }
}

module.exports = { ProjectController };
