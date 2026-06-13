"use strict";

const { BaseService } = require("../../shared/base/BaseService");
const {
  BuilderRepository,
  AmenityRepository,
  ProjectRepository,
  TowerRepository,
  UnitRepository,
  UnitStatusHistoryRepository,
} = require("./project.repository");
const {
  NotFoundError,
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
} = require("../../shared/errors");
const {
  AUDIT_ACTIONS,
} = require("../../shared/constants/app.constants");

class ProjectService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.builderRepository = deps.builderRepository || new BuilderRepository();
    this.amenityRepository = deps.amenityRepository || new AmenityRepository();
    this.projectRepository = deps.projectRepository || new ProjectRepository();
    this.towerRepository = deps.towerRepository || new TowerRepository();
    this.unitRepository = deps.unitRepository || new UnitRepository();
    this.unitStatusHistoryRepository =
      deps.unitStatusHistoryRepository || new UnitStatusHistoryRepository();
  }

  // ---------------------------------------------------------------------------
  // 1. Builder Management
  // ---------------------------------------------------------------------------

  async createBuilder(data, actor) {
    const uppercaseCode = data.code.toUpperCase();

    // Check unique code
    const existingCode = await this.builderRepository.findOne({
      organizationId: actor.organizationId,
      code: uppercaseCode,
      isDeleted: false,
    });
    if (existingCode) {
      throw new ConflictError("Builder", "code", uppercaseCode);
    }

    // Check unique name
    const existingName = await this.builderRepository.findOne({
      organizationId: actor.organizationId,
      name: data.name,
      isDeleted: false,
    });
    if (existingName) {
      throw new ConflictError("Builder", "name", data.name);
    }

    const builder = await this.builderRepository.create({
      ...data,
      organizationId: actor.organizationId,
      branchId: data.branchId || actor.branchId || null,
      code: uppercaseCode,
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: "Builder",
      entityId: builder.id,
      userId: actor.id,
      newValues: { name: builder.name, code: builder.code },
      description: `Builder '${builder.name}' (${builder.code}) created successfully`,
    });

    return builder;
  }

  async updateBuilder(id, data, actor) {
    const builder = await this.builderRepository.findByIdOrFail(id, "Builder");

    if (data.name && data.name !== builder.name) {
      const existingName = await this.builderRepository.findOne({
        organizationId: actor.organizationId,
        name: data.name,
        isDeleted: false,
        _id: { $ne: id },
      });
      if (existingName) {
        throw new ConflictError("Builder", "name", data.name);
      }
    }

    const updated = await this.builderRepository.update(id, {
      ...data,
      updatedBy: actor.id,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: "Builder",
      entityId: id,
      userId: actor.id,
      newValues: data,
      description: `Builder '${builder.name}' updated successfully`,
    });

    return updated;
  }

  async archiveBuilder(id, actor) {
    await this.builderRepository.findByIdOrFail(id, "Builder");
    const updated = await this.builderRepository.softDelete(id, actor.id);

    await this.logAudit({
      action: AUDIT_ACTIONS.DELETE,
      entity: "Builder",
      entityId: id,
      userId: actor.id,
      description: `Builder with ID '${id}' archived/soft-deleted successfully`,
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // 2. Amenity Management
  // ---------------------------------------------------------------------------

  async createAmenity(data, actor) {
    const uppercaseCode = data.code.toUpperCase();

    // Check unique code
    const existingCode = await this.amenityRepository.findOne({
      organizationId: actor.organizationId,
      code: uppercaseCode,
      isDeleted: false,
    });
    if (existingCode) {
      throw new ConflictError("Amenity", "code", uppercaseCode);
    }

    // Check unique name
    const existingName = await this.amenityRepository.findOne({
      organizationId: actor.organizationId,
      name: data.name,
      isDeleted: false,
    });
    if (existingName) {
      throw new ConflictError("Amenity", "name", data.name);
    }

    const amenity = await this.amenityRepository.create({
      ...data,
      organizationId: actor.organizationId,
      branchId: data.branchId || actor.branchId || null,
      code: uppercaseCode,
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: "Amenity",
      entityId: amenity.id,
      userId: actor.id,
      newValues: { name: amenity.name, code: amenity.code },
      description: `Amenity '${amenity.name}' (${amenity.code}) created successfully`,
    });

    return amenity;
  }

  async updateAmenity(id, data, actor) {
    const amenity = await this.amenityRepository.findByIdOrFail(id, "Amenity");

    if (data.name && data.name !== amenity.name) {
      const existingName = await this.amenityRepository.findOne({
        organizationId: actor.organizationId,
        name: data.name,
        isDeleted: false,
        _id: { $ne: id },
      });
      if (existingName) {
        throw new ConflictError("Amenity", "name", data.name);
      }
    }

    const updated = await this.amenityRepository.update(id, {
      ...data,
      updatedBy: actor.id,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: "Amenity",
      entityId: id,
      userId: actor.id,
      newValues: data,
      description: `Amenity '${amenity.name}' updated successfully`,
    });

    return updated;
  }

  async archiveAmenity(id, actor) {
    await this.amenityRepository.findByIdOrFail(id, "Amenity");
    const updated = await this.amenityRepository.softDelete(id, actor.id);

    await this.logAudit({
      action: AUDIT_ACTIONS.DELETE,
      entity: "Amenity",
      entityId: id,
      userId: actor.id,
      description: `Amenity with ID '${id}' archived/soft-deleted successfully`,
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // 3. Project Management
  // ---------------------------------------------------------------------------

  async createProject(data, actor) {
    const uppercaseCode = data.code.toUpperCase();

    // 1. Verify Builder exists
    const builder = await this.builderRepository.findByIdOrFail(data.builderId, "Builder");
    if (builder.organizationId.toString() !== actor.organizationId.toString()) {
      throw new ForbiddenError("Builder belongs to a different organization");
    }

    // 2. Check unique project code
    const existingCode = await this.projectRepository.findOne({
      organizationId: actor.organizationId,
      code: uppercaseCode,
      isDeleted: false,
    });
    if (existingCode) {
      throw new ConflictError("Project", "code", uppercaseCode);
    }

    // 3. Check unique name under same builder
    const existingName = await this.projectRepository.findOne({
      organizationId: actor.organizationId,
      builderId: data.builderId,
      name: data.name,
      isDeleted: false,
    });
    if (existingName) {
      throw new ConflictError("Project", "name under same builder", data.name);
    }

    // 4. Verify amenities exist
    if (data.amenities && data.amenities.length > 0) {
      for (const amenityId of data.amenities) {
        await this.amenityRepository.findByIdOrFail(amenityId, "Amenity");
      }
    }

    const project = await this.projectRepository.create({
      ...data,
      organizationId: actor.organizationId,
      branchId: data.branchId || actor.branchId || null,
      code: uppercaseCode,
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: "Project",
      entityId: project.id,
      userId: actor.id,
      newValues: { name: project.name, code: project.code },
      description: `Project '${project.name}' (${project.code}) created successfully`,
    });

    return project;
  }

  async updateProject(id, data, actor) {
    const project = await this.projectRepository.findByIdOrFail(id, "Project");

    if (data.builderId && data.builderId !== project.builderId.toString()) {
      const builder = await this.builderRepository.findByIdOrFail(data.builderId, "Builder");
      if (builder.organizationId.toString() !== actor.organizationId.toString()) {
        throw new ForbiddenError("Builder belongs to a different organization");
      }
    }

    if (data.name && (data.name !== project.name || (data.builderId && data.builderId !== project.builderId.toString()))) {
      const builderId = data.builderId || project.builderId;
      const existingName = await this.projectRepository.findOne({
        organizationId: actor.organizationId,
        builderId,
        name: data.name,
        isDeleted: false,
        _id: { $ne: id },
      });
      if (existingName) {
        throw new ConflictError("Project", "name under same builder", data.name);
      }
    }

    if (data.amenities && data.amenities.length > 0) {
      for (const amenityId of data.amenities) {
        await this.amenityRepository.findByIdOrFail(amenityId, "Amenity");
      }
    }

    const updated = await this.projectRepository.update(id, {
      ...data,
      updatedBy: actor.id,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: "Project",
      entityId: id,
      userId: actor.id,
      newValues: data,
      description: `Project '${project.name}' updated successfully`,
    });

    return updated;
  }

  async archiveProject(id, actor) {
    await this.projectRepository.findByIdOrFail(id, "Project");

    // Retrieve all active child units belonging to this project
    const units = await this.unitRepository.findMany({ projectId: id, isDeleted: false });

    // 1. Verify that no unit has active reservations, sales, or blocks
    const activeUnit = units.find((u) => ["blocked", "reserved", "sold"].includes(u.availability));
    if (activeUnit) {
      throw new BusinessRuleError(
        `Cannot archive project: Unit '${activeUnit.unitNumber}' is currently ${activeUnit.availability}`,
        "ACTIVE_INVENTORY_EXISTS"
      );
    }

    const unitIds = units.map((u) => u.id);

    // 2. Verify that no scheduled/active SiteVisit exists referencing any of the project's units
    const { SiteVisit } = require("../site-visit/site-visit.model");
    const hasSiteVisits = await SiteVisit.exists({
      property: { $in: unitIds },
      status: "scheduled",
      isDeleted: false,
    });
    if (hasSiteVisits) {
      throw new BusinessRuleError(
        "Cannot archive project: scheduled site visits exist for its inventory units",
        "SCHEDULED_SITE_VISITS_EXISTS"
      );
    }

    // 3. Verify that no active Deal exists referencing any of the project's units
    const { Deal } = require("../deal/deal.model");
    const hasDeals = await Deal.exists({
      property: { $in: unitIds },
      status: { $in: ["draft", "negotiation", "offer_accepted", "agreement_sent"] },
      isDeleted: false,
    });
    if (hasDeals) {
      throw new BusinessRuleError(
        "Cannot archive project: active negotiations or deals exist for its inventory units",
        "ACTIVE_DEALS_EXISTS"
      );
    }

    const updated = await this.projectRepository.softDelete(id, actor.id);

    // 4. Cascade soft delete Towers and Units with individual audit logging
    const towers = await this.towerRepository.findByProject(id);
    for (const tower of towers) {
      await this.towerRepository.softDelete(tower.id, actor.id);
      await this.logAudit({
        action: AUDIT_ACTIONS.DELETE,
        entity: "Tower",
        entityId: tower.id,
        userId: actor.id,
        description: `Tower '${tower.name}' cascadingly archived via parent project soft-deletion`,
      });
    }

    for (const unit of units) {
      await this.unitRepository.softDelete(unit.id, actor.id);
      await this.logAudit({
        action: AUDIT_ACTIONS.DELETE,
        entity: "Unit",
        entityId: unit.id,
        userId: actor.id,
        description: `Unit '${unit.unitNumber}' cascadingly archived via parent project soft-deletion`,
      });
    }

    await this.logAudit({
      action: AUDIT_ACTIONS.DELETE,
      entity: "Project",
      entityId: id,
      userId: actor.id,
      description: `Project with ID '${id}' and child towers/units archived successfully`,
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // 4. Tower Management
  // ---------------------------------------------------------------------------

  async createTower(data, actor) {
    const uppercaseCode = data.code.toUpperCase();

    // 1. Verify Project exists
    const project = await this.projectRepository.findByIdOrFail(data.projectId, "Project");
    if (project.organizationId.toString() !== actor.organizationId.toString()) {
      throw new ForbiddenError("Project belongs to a different organization");
    }

    // 2. Check unique tower code under project
    const existingCode = await this.towerRepository.findOne({
      organizationId: actor.organizationId,
      projectId: data.projectId,
      code: uppercaseCode,
      isDeleted: false,
    });
    if (existingCode) {
      throw new ConflictError("Tower", "code under same project", uppercaseCode);
    }

    // 3. Check unique name under project
    const existingName = await this.towerRepository.findOne({
      organizationId: actor.organizationId,
      projectId: data.projectId,
      name: data.name,
      isDeleted: false,
    });
    if (existingName) {
      throw new ConflictError("Tower", "name under same project", data.name);
    }

    const tower = await this.towerRepository.create({
      ...data,
      organizationId: actor.organizationId,
      branchId: data.branchId || actor.branchId || null,
      code: uppercaseCode,
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: "Tower",
      entityId: tower.id,
      userId: actor.id,
      newValues: { name: tower.name, code: tower.code },
      description: `Tower '${tower.name}' (${tower.code}) created successfully`,
    });

    return tower;
  }

  async updateTower(id, data, actor) {
    const tower = await this.towerRepository.findByIdOrFail(id, "Tower");

    if (data.name && data.name !== tower.name) {
      const existingName = await this.towerRepository.findOne({
        organizationId: actor.organizationId,
        projectId: tower.projectId,
        name: data.name,
        isDeleted: false,
        _id: { $ne: id },
      });
      if (existingName) {
        throw new ConflictError("Tower", "name under same project", data.name);
      }
    }

    const updated = await this.towerRepository.update(id, {
      ...data,
      updatedBy: actor.id,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: "Tower",
      entityId: id,
      userId: actor.id,
      newValues: data,
      description: `Tower '${tower.name}' updated successfully`,
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // 5. Unit Management
  // ---------------------------------------------------------------------------

  async createUnit(data, actor) {
    // 1. Verify Project and Tower exist
    const project = await this.projectRepository.findByIdOrFail(data.projectId, "Project");
    const tower = await this.towerRepository.findByIdOrFail(data.towerId, "Tower");

    if (project.organizationId.toString() !== actor.organizationId.toString()) {
      throw new ForbiddenError("Project belongs to a different organization");
    }
    if (tower.projectId.toString() !== project.id.toString()) {
      throw new BusinessRuleError("Tower does not belong to the selected Project", "INVALID_TOWER_RELATION");
    }

    // 2. Check unique unit number inside same project tower
    const existingUnit = await this.unitRepository.findOne({
      organizationId: actor.organizationId,
      projectId: data.projectId,
      towerId: data.towerId,
      unitNumber: data.unitNumber,
      isDeleted: false,
    });
    if (existingUnit) {
      throw new ConflictError("Unit", "unitNumber in tower", data.unitNumber);
    }

    const unit = await this.unitRepository.create({
      ...data,
      organizationId: actor.organizationId,
      branchId: data.branchId || actor.branchId || null,
      availability: "available",
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: "Unit",
      entityId: unit.id,
      userId: actor.id,
      newValues: { unitNumber: unit.unitNumber, price: unit.price, configuration: unit.configuration },
      description: `Inventory Unit '${unit.unitNumber}' created in project '${project.name}' tower '${tower.name}'`,
    });

    // Write initial status history
    await this.unitStatusHistoryRepository.create({
      organizationId: actor.organizationId,
      branchId: unit.branchId,
      unitId: unit.id,
      previousStatus: "available",
      newStatus: "available",
      changedBy: actor.id,
      reason: "Initial inventory unit registration",
    });

    return unit;
  }

  async updateUnit(id, data, actor) {
    const unit = await this.unitRepository.findByIdOrFail(id, "Unit");

    if (unit.availability === "sold") {
      throw new BusinessRuleError("Sold inventory units are locked and cannot be updated", "UNIT_SOLD_IMMUTABLE");
    }

    if (data.unitNumber && data.unitNumber !== unit.unitNumber) {
      const existingUnit = await this.unitRepository.findOne({
        organizationId: actor.organizationId,
        projectId: unit.projectId,
        towerId: unit.towerId,
        unitNumber: data.unitNumber,
        isDeleted: false,
        _id: { $ne: id },
      });
      if (existingUnit) {
        throw new ConflictError("Unit", "unitNumber in tower", data.unitNumber);
      }
    }

    const updated = await this.unitRepository.update(id, {
      ...data,
      updatedBy: actor.id,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: "Unit",
      entityId: id,
      userId: actor.id,
      newValues: data,
      description: `Unit '${unit.unitNumber}' updated successfully`,
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Unit Atomic Status Transitions & Lifecycles
  // ---------------------------------------------------------------------------

  async blockUnit(id, blockData, actor) {
    // 1. Perform atomic update with available condition filter
    const lockedUntil = new Date(Date.now() + blockData.lockedDurationMinutes * 60000);
    const updated = await this.unitRepository.findOneAndUpdate(
      { _id: id, availability: "available" },
      {
        $set: {
          availability: "blocked",
          lockedBy: blockData.lockedBy,
          lockedUntil,
          updatedBy: actor.id,
        },
      }
    );

    // 2. If update failed (returns null), run precise diagnostics
    if (!updated) {
      const unit = await this.unitRepository.findByIdOrFail(id, "Unit");
      if (unit.availability === "sold") {
        throw new BusinessRuleError("Sold units cannot be blocked", "UNIT_SOLD");
      }
      if (unit.availability === "blocked") {
        throw new BusinessRuleError("Unit is already blocked", "UNIT_ALREADY_BLOCKED");
      }
      if (unit.availability === "reserved") {
        throw new BusinessRuleError("Reserved units cannot be blocked directly", "UNIT_RESERVED");
      }
      throw new BusinessRuleError("Unit is currently unavailable for blocking", "UNIT_UNAVAILABLE");
    }

    // 3. Log Unit Status History
    await this.unitStatusHistoryRepository.create({
      organizationId: actor.organizationId,
      branchId: updated.branchId,
      unitId: id,
      previousStatus: updated.availability, // "available"
      newStatus: "blocked",
      changedBy: actor.id,
      reason: `Blocked for ${blockData.lockedDurationMinutes} minutes`,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      entity: "Unit",
      entityId: id,
      userId: actor.id,
      newValues: { availability: "blocked", lockedBy: blockData.lockedBy, lockedUntil },
      description: `Unit '${updated.unitNumber}' locked/blocked for ${blockData.lockedDurationMinutes} minutes`,
    });

    // Return the updated unit state
    return this.unitRepository.findById(id);
  }

  async reserveUnit(id, reserveData, actor) {
    // 1. Verify Lead exists in tenant boundaries
    const { Lead } = require("../lead/lead.model");
    const lead = await Lead.findById(reserveData.reservedByLeadId);
    if (!lead || lead.isDeleted) {
      throw new NotFoundError("Lead", reserveData.reservedByLeadId);
    }
    if (lead.organizationId.toString() !== actor.organizationId.toString()) {
      throw new ForbiddenError("Lead belongs to a different organization");
    }

    // 2. Perform atomic update with available or blocked condition filter
    const updated = await this.unitRepository.findOneAndUpdate(
      { _id: id, availability: { $in: ["available", "blocked"] } },
      {
        $set: {
          availability: "reserved",
          reservedByLeadId: reserveData.reservedByLeadId,
          updatedBy: actor.id,
        },
      }
    );

    // 3. If update failed (returns null), run precise diagnostics
    if (!updated) {
      const unit = await this.unitRepository.findByIdOrFail(id, "Unit");
      if (unit.availability === "sold") {
        throw new BusinessRuleError("Sold units cannot be reserved", "UNIT_SOLD");
      }
      if (unit.availability === "reserved") {
        throw new BusinessRuleError("Unit is already reserved", "UNIT_RESERVED");
      }
      throw new BusinessRuleError("Unit is currently unavailable for reservation", "UNIT_UNAVAILABLE");
    }

    // 4. Log Unit Status History
    await this.unitStatusHistoryRepository.create({
      organizationId: actor.organizationId,
      branchId: updated.branchId,
      unitId: id,
      previousStatus: updated.availability, // "available"
      newStatus: "reserved",
      changedBy: actor.id,
      reason: `Reserved for Lead ID '${reserveData.reservedByLeadId}'`,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      entity: "Unit",
      entityId: id,
      userId: actor.id,
      newValues: { availability: "reserved", reservedByLeadId: reserveData.reservedByLeadId },
      description: `Unit '${updated.unitNumber}' reserved for Lead '${reserveData.reservedByLeadId}'`,
    });

    return this.unitRepository.findById(id);
  }

  async markUnitSold(id, soldData, actor) {
    // 1. Verify Customer exists in tenant boundaries
    const { Customer } = require("../customer/customer.model");
    const customer = await Customer.findById(soldData.soldToCustomerId);
    if (!customer || customer.isDeleted) {
      throw new NotFoundError("Customer", soldData.soldToCustomerId);
    }
    if (customer.organizationId.toString() !== actor.organizationId.toString()) {
      throw new ForbiddenError("Customer belongs to a different organization");
    }

    // 2. Perform atomic update with available or reserved condition filter
    const updated = await this.unitRepository.findOneAndUpdate(
      { _id: id, availability: { $in: ["available", "reserved"] } },
      {
        $set: {
          availability: "sold",
          soldToCustomerId: soldData.soldToCustomerId,
          soldPrice: soldData.soldPrice,
          soldDate: new Date(soldData.soldDate),
          updatedBy: actor.id,
        },
      }
    );

    // 3. If update failed (returns null), run precise diagnostics
    if (!updated) {
      const unit = await this.unitRepository.findByIdOrFail(id, "Unit");
      if (unit.availability === "sold") {
        throw new BusinessRuleError("Unit is already sold", "UNIT_ALREADY_SOLD");
      }
      if (unit.availability === "blocked") {
        throw new BusinessRuleError("Blocked units cannot be sold directly", "UNIT_BLOCKED");
      }
      throw new BusinessRuleError("Unit is currently unavailable for sale", "UNIT_UNAVAILABLE");
    }

    // 4. Log Unit Status History
    await this.unitStatusHistoryRepository.create({
      organizationId: actor.organizationId,
      branchId: updated.branchId,
      unitId: id,
      previousStatus: updated.availability,
      newStatus: "sold",
      changedBy: actor.id,
      reason: `Sold to Customer ID '${soldData.soldToCustomerId}'`,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      entity: "Unit",
      entityId: id,
      userId: actor.id,
      newValues: { availability: "sold", soldToCustomerId: soldData.soldToCustomerId, soldPrice: soldData.soldPrice },
      description: `Unit '${updated.unitNumber}' marked as SOLD to Customer '${soldData.soldToCustomerId}' for price ${soldData.soldPrice}`,
    });

    return this.unitRepository.findById(id);
  }

  async releaseUnit(id, actor) {
    // 1. Perform atomic update with blocked or reserved condition filter (Sold units are immutable and locked)
    const updated = await this.unitRepository.findOneAndUpdate(
      { _id: id, availability: { $in: ["blocked", "reserved"] } },
      {
        $set: {
          availability: "available",
          lockedBy: null,
          lockedUntil: null,
          reservedByLeadId: null,
          soldToCustomerId: null,
          soldPrice: null,
          soldDate: null,
          updatedBy: actor.id,
        },
      }
    );

    // 2. If update failed (returns null), run precise diagnostics
    if (!updated) {
      const unit = await this.unitRepository.findByIdOrFail(id, "Unit");
      if (unit.availability === "sold") {
        throw new BusinessRuleError("Sold units are permanently locked and cannot be released", "UNIT_SOLD_IMMUTABLE");
      }
      if (unit.availability === "available") {
        throw new BusinessRuleError("Unit is already available", "UNIT_ALREADY_AVAILABLE");
      }
      throw new BusinessRuleError("Unit is currently unavailable for release", "UNIT_UNAVAILABLE");
    }

    // 3. Log Unit Status History
    await this.unitStatusHistoryRepository.create({
      organizationId: actor.organizationId,
      branchId: updated.branchId,
      unitId: id,
      previousStatus: updated.availability,
      newStatus: "available",
      changedBy: actor.id,
      reason: "Inventory released back to public available status",
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      entity: "Unit",
      entityId: id,
      userId: actor.id,
      newValues: { availability: "available" },
      description: `Unit '${updated.unitNumber}' released back to available inventory`,
    });

    return this.unitRepository.findById(id);
  }
}

module.exports = { ProjectService };
