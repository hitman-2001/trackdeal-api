'use strict';

const { BaseService } = require('../../shared/base/BaseService');
const { AgreementRepository, AgreementTemplateRepository } = require('./agreement.repository');
const { BusinessRuleError, NotFoundError } = require('../../shared/errors');
const { AUDIT_ACTIONS, EVENTS } = require('../../shared/constants/app.constants');

class AgreementService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.agreementRepository = deps.agreementRepository || new AgreementRepository();
    this.templateRepository = deps.templateRepository || new AgreementTemplateRepository();
    this.repository = this.agreementRepository;
  }

  /**
   * Create an agreement template.
   */
  async createTemplate(data, actor) {
    const template = await this.templateRepository.create({
      ...data,
      createdBy: actor.id,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: 'AgreementTemplate',
      entityId: template.id,
      userId: actor.id,
      description: `Created agreement template: '${template.name}'`,
      newValues: template.toObject(),
    });

    return template;
  }

  /**
   * List all templates.
   */
  async listTemplates(pagination) {
    return this.templateRepository.paginate({}, pagination);
  }

  /**
   * Generate an agreement from a template and Deal context.
   */
  async generateAgreement({ dealId, templateId }, actor) {
    const Deal = require('mongoose').model('Deal');
    // Fully populate the deal context to extract variables
    const deal = await Deal.findById(dealId)
      .populate('customer')
      .populate('property')
      .populate('broker');

    if (!deal) throw new NotFoundError('Deal', dealId);

    const template = await this.templateRepository.findByIdOrFail(templateId, 'AgreementTemplate');
    if (!template.isActive) {
      throw new BusinessRuleError('This agreement template is inactive', 'TEMPLATE_INACTIVE');
    }

    // Resolve variables
    const variablesData = {
      dealNumber: deal.dealNumber || '',
      dealValue: String(deal.dealValue || deal.agreedPrice || 0),
      customerName: deal.customer ? `${deal.customer.firstName} ${deal.customer.lastName}` : '',
      customerEmail: deal.customer?.email || '',
      propertyTitle: deal.property?.title || '',
      propertyAddress: deal.property?.location?.address || '',
      brokerName: deal.broker ? `${deal.broker.firstName} ${deal.broker.lastName}` : '',
      date: new Date().toLocaleDateString('en-IN'),
    };

    // Compile content
    let compiledContent = template.content;
    for (const [key, value] of Object.entries(variablesData)) {
      compiledContent = compiledContent.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
    }

    const agreement = await this.agreementRepository.create({
      template: templateId,
      deal: dealId,
      customer: deal.customer?.id || deal.customer,
      property: deal.property?.id || deal.property,
      content: compiledContent,
      variablesData,
      status: 'draft',
      createdBy: actor.id,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: 'Agreement',
      entityId: agreement.id,
      userId: actor.id,
      description: `Generated agreement ${agreement.agreementNumber} from template '${template.name}'`,
      newValues: agreement.toObject(),
    });

    await this.publishEvent(EVENTS.AGREEMENT_GENERATED, { agreementId: agreement.id });
    return agreement;
  }

  /**
   * Sign an agreement.
   */
  async signAgreement(id, actor) {
    const agreement = await this.agreementRepository.findByIdOrFail(id, 'Agreement');
    if (agreement.status === 'signed') {
      throw new BusinessRuleError('Agreement is already signed', 'AGREEMENT_ALREADY_SIGNED');
    }
    if (agreement.status === 'void') {
      throw new BusinessRuleError('Voided agreements cannot be signed', 'AGREEMENT_VOIDED');
    }

    const oldValues = agreement.toObject();
    agreement.status = 'signed';
    agreement.signedAt = new Date();
    agreement.signedBy = actor.id;
    agreement.updatedBy = actor.id;
    await agreement.save();

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'Agreement',
      entityId: id,
      userId: actor.id,
      description: `Signed agreement: ${agreement.agreementNumber}`,
      oldValues,
      newValues: agreement.toObject(),
    });

    await this.publishEvent(EVENTS.AGREEMENT_SIGNED, { agreementId: agreement.id });
    return agreement;
  }

  /**
   * Void an agreement.
   */
  async voidAgreement(id, actor) {
    const agreement = await this.agreementRepository.findByIdOrFail(id, 'Agreement');
    if (agreement.status === 'void') {
      throw new BusinessRuleError('Agreement is already voided', 'AGREEMENT_ALREADY_VOIDED');
    }

    const oldValues = agreement.toObject();
    agreement.status = 'void';
    agreement.updatedBy = actor.id;
    await agreement.save();

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'Agreement',
      entityId: id,
      userId: actor.id,
      description: `Voided agreement: ${agreement.agreementNumber}`,
      oldValues,
      newValues: agreement.toObject(),
    });

    return agreement;
  }

  /**
   * List agreements.
   */
  async listAgreements(query) {
    const filter = { isDeleted: false };
    if (query.status) filter.status = query.status;
    if (query.customerId) filter.customer = query.customerId;
    if (query.dealId) filter.deal = query.dealId;

    return this.agreementRepository.paginate(filter, {
      page: query.page,
      limit: query.limit,
      populate: ['customer', 'property', 'template'],
    });
  }
}

module.exports = { AgreementService };
