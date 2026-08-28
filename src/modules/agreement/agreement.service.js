'use strict';

const mongoose = require('mongoose');
const { BaseService } = require('../../shared/base/BaseService');
const { AgreementRepository, DocumentTemplateRepository } = require('./agreement.repository');
const { DocumentTemplate } = require('./document-template.model');
const { DEFAULT_SALE_DEED_TEMPLATE } = require('./agreement.seed');
const {
  numberToIndianWords,
  compileAgreementContent,
} = require('./placeholder-engine');
const { BusinessRuleError, NotFoundError } = require('../../shared/errors');
const { AUDIT_ACTIONS, EVENTS } = require('../../shared/constants/app.constants');

class AgreementService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.agreementRepository = deps.agreementRepository || new AgreementRepository();
    this.templateRepository = deps.templateRepository || new DocumentTemplateRepository();
    this.repository = this.agreementRepository;
  }

  /**
   * Seed default system templates if not present.
   */
  async ensureSystemTemplates() {
    const existing = await DocumentTemplate.findOne({
      templateCode: DEFAULT_SALE_DEED_TEMPLATE.templateCode,
      isSystemDefault: true,
    });
    if (!existing) {
      await DocumentTemplate.create({
        ...DEFAULT_SALE_DEED_TEMPLATE,
        isSystemDefault: true,
        isActive: true,
      });
    }
  }

  /**
   * List templates available to the organization.
   */
  async listTemplates(actor) {
    await this.ensureSystemTemplates();
    const query = {
      isActive: true,
      $or: [{ isSystemDefault: true }],
    };
    if (actor.organizationId) {
      query.$or.push({ organizationId: actor.organizationId });
    }
    return DocumentTemplate.find(query).sort({ isSystemDefault: -1, name: 1 });
  }

  /**
   * Get template by ID.
   */
  async getTemplateById(templateId) {
    await this.ensureSystemTemplates();
    const template = await DocumentTemplate.findById(templateId);
    if (!template) throw new NotFoundError('DocumentTemplate', templateId);
    return template;
  }

  /**
   * Create a custom template for an organization.
   */
  async createTemplate(data, actor) {
    const template = await DocumentTemplate.create({
      ...data,
      organizationId: actor.organizationId,
      isSystemDefault: false,
      createdBy: actor.id,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: 'DocumentTemplate',
      entityId: template.id,
      userId: actor.id,
      description: `Created custom agreement template: '${template.name}'`,
      newValues: template.toObject(),
    });

    return template;
  }

  /**
   * List agreements for organization with KPI metrics and filters.
   */
  async listAgreements(query = {}, actor) {
    const orgId = actor.organizationId;
    const filter = { isDeleted: { $ne: true } };
    if (orgId) {
      filter.organizationId = orgId;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search) {
      const q = query.search.trim();
      const numRegex = new RegExp(q, 'i');
      filter.$or = [
        { agreementNumber: numRegex },
        { 'structuredData.property.flatNumber': numRegex },
        { 'structuredData.property.buildingName': numRegex },
        { 'structuredData.transferors.name': numRegex },
        { 'structuredData.transferees.name': numRegex },
      ];
    }

    const sort = { createdAt: -1 };
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [items, total, summaryAgg] = await Promise.all([
      this.agreementRepository.model
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('customerId', 'firstName lastName mobile email')
        .populate('propertyId', 'title location price')
        .populate('dealId', 'dealNumber agreedPrice')
        .populate('createdBy', 'firstName lastName')
        .lean(),
      this.agreementRepository.model.countDocuments(filter),
      this.agreementRepository.model.aggregate([
        { $match: orgId ? { organizationId: new mongoose.Types.ObjectId(orgId), isDeleted: { $ne: true } } : { isDeleted: { $ne: true } } },
        {
          $group: {
            _id: null,
            totalCount: { $sum: 1 },
            draftCount: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
            readyForPrintCount: { $sum: { $cond: [{ $eq: ['$status', 'ready_for_print'] }, 1, 0] } },
            executedCount: { $sum: { $cond: [{ $eq: ['$status', 'executed'] }, 1, 0] } },
            cancelledCount: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const summary = summaryAgg[0] || {
      totalCount: total,
      draftCount: 0,
      readyForPrintCount: 0,
      executedCount: 0,
      cancelledCount: 0,
    };

    return {
      data: items,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
      summary,
    };
  }

  /**
   * Get single agreement by ID.
   */
  async getAgreementById(id, actor) {
    const agreement = await this.agreementRepository.model
      .findOne({ _id: id, organizationId: actor.organizationId, isDeleted: { $ne: true } })
      .populate('templateId')
      .populate('customerId')
      .populate('propertyId')
      .populate('dealId')
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName');

    if (!agreement) throw new NotFoundError('Agreement', id);
    return agreement;
  }

  /**
   * Create an agreement from guided wizard.
   */
  async createAgreement(data, actor) {
    await this.ensureSystemTemplates();
    const templateId = data.templateId || (await DocumentTemplate.findOne({ isSystemDefault: true }))._id;
    const template = await DocumentTemplate.findById(templateId);
    if (!template) throw new NotFoundError('DocumentTemplate', templateId);

    const structuredData = data.structuredData || {};

    // Auto calculate amount in words if total consideration given
    const totalAmount = Number(structuredData.consideration?.totalAmount) || 0;
    if (!structuredData.consideration?.amountInWords && totalAmount > 0) {
      if (!structuredData.consideration) structuredData.consideration = {};
      structuredData.consideration.amountInWords = numberToIndianWords(totalAmount);
    }

    // Compile clauses from master template
    const { compiledClauses } = compileAgreementContent(template.clauses, structuredData);
    const compiledHtml = compiledClauses.map((c) => c.content).join('<hr style="margin: 30px 0; border: none; border-top: 1px solid #cbd5e1;"/>');

    const agreement = new this.agreementRepository.model({
      organizationId: actor.organizationId,
      branchId: actor.branchId || null,
      templateId: template._id,
      templateVersion: template.version || '1.0',
      agreementType: template.name || 'Agreement for Sale-Deed',
      leadId: data.leadId || null,
      dealId: data.dealId || null,
      propertyId: data.propertyId || null,
      customerId: data.customerId || null,
      status: data.status || 'draft',
      pageSettings: data.pageSettings || template.pageSettings || {
        pageSize: 'a4',
        orientation: 'portrait',
        margins: 'normal',
        marginTop: 25.4,
        marginBottom: 25.4,
        marginLeft: 25.4,
        marginRight: 25.4,
      },
      structuredData,
      clauses: compiledClauses,
      compiledHtml,
      currentVersionNumber: 1,
      versions: [
        {
          versionNumber: 1,
          clauses: compiledClauses,
          structuredData,
          modifiedBy: actor.id,
          modifiedAt: new Date(),
          changeSummary: 'Initial generation from template',
        },
      ],
      auditLog: [
        {
          action: 'CREATED',
          performedBy: actor.id,
          performedAt: new Date(),
          details: `Agreement generated from template '${template.name}'`,
        },
      ],
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    await agreement.save();

    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: 'Agreement',
      entityId: agreement.id,
      userId: actor.id,
      description: `Created agreement ${agreement.agreementNumber}`,
      newValues: agreement.toObject(),
    });

    return agreement;
  }

  /**
   * Edit Details Mode: Updates structured variable fields and recompiles clauses.
   */
  async updateStructuredDetails(agreementId, inputData, actor) {
    const agreement = await this.agreementRepository.model.findOne({
      _id: agreementId,
      organizationId: actor.organizationId,
    });
    if (!agreement) throw new NotFoundError('Agreement', agreementId);

    const structuredData = inputData.structuredData || inputData;
    const totalAmount = Number(structuredData.consideration?.totalAmount) || 0;
    if (totalAmount > 0) {
      if (!structuredData.consideration) structuredData.consideration = {};
      structuredData.consideration.amountInWords = numberToIndianWords(totalAmount);
    }

    if (inputData.pageSettings) {
      agreement.pageSettings = inputData.pageSettings;
    }

    const template = await DocumentTemplate.findById(agreement.templateId);
    const templateClauses = template ? template.clauses : agreement.clauses;

    // Compile new standard clauses
    const { compiledClauses } = compileAgreementContent(templateClauses, structuredData);

    // Merge: Keep custom clauses that were added to this specific agreement
    const customClauses = (agreement.clauses || []).filter((c) => c.isCustom);
    const finalClauses = [...compiledClauses, ...customClauses].sort((a, b) => (a.order || 0) - (b.order || 0));

    agreement.structuredData = structuredData;
    if (data.pageSettings) {
      agreement.pageSettings = data.pageSettings;
    }
    agreement.clauses = finalClauses;
    agreement.compiledHtml = finalClauses.map((c) => c.content).join('<hr style="margin: 30px 0; border: none; border-top: 1px solid #cbd5e1;"/>');
    agreement.currentVersionNumber = (agreement.currentVersionNumber || 1) + 1;
    agreement.updatedBy = actor.id;

    agreement.versions.push({
      versionNumber: agreement.currentVersionNumber,
      clauses: finalClauses,
      structuredData,
      modifiedBy: actor.id,
      modifiedAt: new Date(),
      changeSummary: 'Updated structured transaction fields',
    });

    agreement.auditLog.push({
      action: 'UPDATED_DETAILS',
      performedBy: actor.id,
      performedAt: new Date(),
      details: 'Updated buyer/seller, property, or payment parameters',
    });

    await agreement.save();
    return agreement;
  }

  /**
   * Full Document Editor Mode: Updates individual clauses and ordering.
   */
  async updateClauses(agreementId, { clauses, pageSettings, changeSummary }, actor) {
    const agreement = await this.agreementRepository.model.findOne({
      _id: agreementId,
      organizationId: actor.organizationId,
    });
    if (!agreement) throw new NotFoundError('Agreement', agreementId);

    if (clauses) agreement.clauses = clauses;
    if (pageSettings) agreement.pageSettings = pageSettings;
    agreement.compiledHtml = (agreement.clauses || []).map((c) => c.content).join('<hr style="margin: 30px 0; border: none; border-top: 1px solid #cbd5e1;"/>');
    agreement.currentVersionNumber = (agreement.currentVersionNumber || 1) + 1;
    agreement.updatedBy = actor.id;

    agreement.versions.push({
      versionNumber: agreement.currentVersionNumber,
      clauses,
      structuredData: agreement.structuredData,
      modifiedBy: actor.id,
      modifiedAt: new Date(),
      changeSummary: changeSummary || 'Edited legal clauses in Full Document Editor',
    });

    agreement.auditLog.push({
      action: 'EDITED_CLAUSES',
      performedBy: actor.id,
      performedAt: new Date(),
      details: changeSummary || 'Modified clause wording or order',
    });

    await agreement.save();
    return agreement;
  }

  /**
   * Insert custom clause into agreement.
   */
  async addCustomClause(agreementId, { title, content, insertAfterOrder }, actor) {
    const agreement = await this.agreementRepository.model.findOne({
      _id: agreementId,
      organizationId: actor.organizationId,
    });
    if (!agreement) throw new NotFoundError('Agreement', agreementId);

    const targetOrder = insertAfterOrder !== undefined ? insertAfterOrder + 0.5 : (agreement.clauses.length + 1);
    const newClause = {
      clauseId: `custom_clause_${Date.now()}`,
      title: title || 'Additional Condition',
      order: targetOrder,
      content: content || '<p>Additional clause text...</p>',
      isMandatory: false,
      isCustom: true,
    };

    agreement.clauses.push(newClause);
    agreement.clauses.sort((a, b) => (a.order || 0) - (b.order || 0));

    // Re-index orders as whole integers
    agreement.clauses.forEach((c, idx) => {
      c.order = idx + 1;
    });

    agreement.compiledHtml = agreement.clauses.map((c) => c.content).join('<hr style="margin: 30px 0; border: none; border-top: 1px solid #cbd5e1;"/>');
    agreement.currentVersionNumber = (agreement.currentVersionNumber || 1) + 1;
    agreement.updatedBy = actor.id;

    agreement.versions.push({
      versionNumber: agreement.currentVersionNumber,
      clauses: agreement.clauses,
      structuredData: agreement.structuredData,
      modifiedBy: actor.id,
      modifiedAt: new Date(),
      changeSummary: `Added custom clause '${title}'`,
    });

    agreement.auditLog.push({
      action: 'ADDED_CUSTOM_CLAUSE',
      performedBy: actor.id,
      performedAt: new Date(),
      details: `Added custom clause '${title}'`,
    });

    await agreement.save();
    return agreement;
  }

  /**
   * Reset single clause to master template.
   */
  async resetClause(agreementId, clauseId, actor) {
    const agreement = await this.agreementRepository.model.findOne({
      _id: agreementId,
      organizationId: actor.organizationId,
    });
    if (!agreement) throw new NotFoundError('Agreement', agreementId);

    const template = await DocumentTemplate.findById(agreement.templateId);
    if (!template) throw new NotFoundError('DocumentTemplate', agreement.templateId);

    const origClause = template.clauses.find((c) => c.clauseId === clauseId);
    if (!origClause) {
      throw new BusinessRuleError('Clause not found in master template', 'CLAUSE_NOT_IN_TEMPLATE');
    }

    // Recompile only this clause with current structured data
    const { compiledClauses } = compileAgreementContent([origClause], agreement.structuredData);
    const recompiled = compiledClauses[0];

    const idx = agreement.clauses.findIndex((c) => c.clauseId === clauseId);
    if (idx !== -1) {
      agreement.clauses[idx].content = recompiled.content;
      agreement.clauses[idx].title = origClause.title;
    } else {
      agreement.clauses.push(recompiled);
      agreement.clauses.sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    agreement.compiledHtml = agreement.clauses.map((c) => c.content).join('<hr style="margin: 30px 0; border: none; border-top: 1px solid #cbd5e1;"/>');
    agreement.currentVersionNumber = (agreement.currentVersionNumber || 1) + 1;
    agreement.updatedBy = actor.id;

    agreement.versions.push({
      versionNumber: agreement.currentVersionNumber,
      clauses: agreement.clauses,
      structuredData: agreement.structuredData,
      modifiedBy: actor.id,
      modifiedAt: new Date(),
      changeSummary: `Reset clause '${origClause.title}' to master template`,
    });

    await agreement.save();
    return agreement;
  }

  /**
   * Reset full agreement to master template.
   */
  async resetFullAgreement(agreementId, actor) {
    const agreement = await this.agreementRepository.model.findOne({
      _id: agreementId,
      organizationId: actor.organizationId,
    });
    if (!agreement) throw new NotFoundError('Agreement', agreementId);

    const template = await DocumentTemplate.findById(agreement.templateId);
    if (!template) throw new NotFoundError('DocumentTemplate', agreement.templateId);

    const { compiledClauses } = compileAgreementContent(template.clauses, agreement.structuredData);

    agreement.clauses = compiledClauses;
    agreement.compiledHtml = compiledClauses.map((c) => c.content).join('<hr style="margin: 30px 0; border: none; border-top: 1px solid #cbd5e1;"/>');
    agreement.currentVersionNumber = (agreement.currentVersionNumber || 1) + 1;
    agreement.updatedBy = actor.id;

    agreement.versions.push({
      versionNumber: agreement.currentVersionNumber,
      clauses: compiledClauses,
      structuredData: agreement.structuredData,
      modifiedBy: actor.id,
      modifiedAt: new Date(),
      changeSummary: 'Reset full agreement to master template',
    });

    agreement.auditLog.push({
      action: 'RESET_TO_TEMPLATE',
      performedBy: actor.id,
      performedAt: new Date(),
      details: 'Reset all clauses to standard template text',
    });

    await agreement.save();
    return agreement;
  }

  /**
   * Duplicate agreement.
   */
  async duplicateAgreement(agreementId, actor) {
    const source = await this.agreementRepository.model.findOne({
      _id: agreementId,
      organizationId: actor.organizationId,
    });
    if (!source) throw new NotFoundError('Agreement', agreementId);

    const duplicate = new this.agreementRepository.model({
      organizationId: actor.organizationId,
      branchId: actor.branchId || source.branchId || null,
      templateId: source.templateId,
      templateVersion: source.templateVersion,
      agreementType: source.agreementType,
      leadId: source.leadId,
      dealId: source.dealId,
      propertyId: source.propertyId,
      customerId: source.customerId,
      status: 'draft',
      structuredData: JSON.parse(JSON.stringify(source.structuredData)),
      clauses: JSON.parse(JSON.stringify(source.clauses)),
      compiledHtml: source.compiledHtml,
      currentVersionNumber: 1,
      versions: [
        {
          versionNumber: 1,
          clauses: source.clauses,
          structuredData: source.structuredData,
          modifiedBy: actor.id,
          modifiedAt: new Date(),
          changeSummary: `Cloned from ${source.agreementNumber}`,
        },
      ],
      auditLog: [
        {
          action: 'DUPLICATED',
          performedBy: actor.id,
          performedAt: new Date(),
          details: `Duplicated from agreement ${source.agreementNumber}`,
        },
      ],
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    await duplicate.save();
    return duplicate;
  }

  /**
   * Update agreement status.
   */
  async updateStatus(agreementId, status, actor) {
    const agreement = await this.agreementRepository.model.findOne({
      _id: agreementId,
      organizationId: actor.organizationId,
    });
    if (!agreement) throw new NotFoundError('Agreement', agreementId);

    agreement.status = status;
    if (status === 'executed') {
      agreement.executedAt = new Date();
    }
    if (status === 'ready_for_print') {
      agreement.printedAt = new Date();
    }
    agreement.updatedBy = actor.id;

    agreement.auditLog.push({
      action: 'STATUS_CHANGED',
      performedBy: actor.id,
      performedAt: new Date(),
      details: `Status transitioned to '${status}'`,
    });

    await agreement.save();
    return agreement;
  }
}

module.exports = { AgreementService };
