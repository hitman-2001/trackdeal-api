"use strict";

const {
  Builder,
  Amenity,
  Project,
  Tower,
  Unit,
  UnitStatusHistory,
} = require("./project.model");
const { BaseRepository } = require("../../shared/base/BaseRepository");

// ---------------------------------------------------------------------------
// 1. BuilderRepository
// ---------------------------------------------------------------------------
class BuilderRepository extends BaseRepository {
  constructor() {
    super(Builder);
  }

  async findByCode(code) {
    return this.findOne({ code: code.toUpperCase(), isDeleted: false });
  }
}

// ---------------------------------------------------------------------------
// 2. AmenityRepository
// ---------------------------------------------------------------------------
class AmenityRepository extends BaseRepository {
  constructor() {
    super(Amenity);
  }

  async findByCode(code) {
    return this.findOne({ code: code.toUpperCase(), isDeleted: false });
  }
}

// ---------------------------------------------------------------------------
// 3. ProjectRepository
// ---------------------------------------------------------------------------
class ProjectRepository extends BaseRepository {
  constructor() {
    super(Project);
  }

  async findByCode(code) {
    return this.findOne({ code: code.toUpperCase(), isDeleted: false });
  }

  async findByBuilder(builderId) {
    return this.findMany({ builderId, isDeleted: false });
  }
}

// ---------------------------------------------------------------------------
// 4. TowerRepository
// ---------------------------------------------------------------------------
class TowerRepository extends BaseRepository {
  constructor() {
    super(Tower);
  }

  async findByCode(projectId, code) {
    return this.findOne({ projectId, code: code.toUpperCase(), isDeleted: false });
  }

  async findByProject(projectId) {
    return this.findMany({ projectId, isDeleted: false });
  }
}

// ---------------------------------------------------------------------------
// 5. UnitRepository
// ---------------------------------------------------------------------------
class UnitRepository extends BaseRepository {
  constructor() {
    super(Unit);
  }

  async findByUnitNumber(projectId, towerId, unitNumber) {
    return this.findOne({ projectId, towerId, unitNumber, isDeleted: false });
  }

  async findByProjectAndTower(projectId, towerId) {
    return this.findMany({ projectId, towerId, isDeleted: false });
  }

  async findAvailableInProject(projectId) {
    return this.findMany({ projectId, availability: "available", isDeleted: false });
  }
}

// ---------------------------------------------------------------------------
// 6. UnitStatusHistoryRepository
// ---------------------------------------------------------------------------
class UnitStatusHistoryRepository extends BaseRepository {
  constructor() {
    super(UnitStatusHistory);
  }

  async findByUnit(unitId) {
    return this.findMany({ unitId }, { sort: { createdAt: -1 } });
  }
}

module.exports = {
  BuilderRepository,
  AmenityRepository,
  ProjectRepository,
  TowerRepository,
  UnitRepository,
  UnitStatusHistoryRepository,
};
