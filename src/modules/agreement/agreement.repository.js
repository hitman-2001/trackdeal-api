'use strict';

const { Agreement } = require('./agreement.model');
const { DocumentTemplate } = require('./document-template.model');
const { BaseRepository } = require('../../shared/base/BaseRepository');

class AgreementRepository extends BaseRepository {
  constructor() {
    super(Agreement);
  }

  async findByDeal(dealId, organizationId) {
    return this.findMany({ dealId, organizationId, isDeleted: false });
  }

  async findByProperty(propertyId, organizationId) {
    return this.findMany({ propertyId, organizationId, isDeleted: false });
  }
}

class DocumentTemplateRepository extends BaseRepository {
  constructor() {
    super(DocumentTemplate);
  }

  async findActiveForOrg(organizationId) {
    return this.model.find({
      $or: [
        { isSystemDefault: true, isActive: true },
        { organizationId, isActive: true }
      ]
    }).sort({ isSystemDefault: -1, name: 1 });
  }
}

module.exports = { AgreementRepository, DocumentTemplateRepository };
