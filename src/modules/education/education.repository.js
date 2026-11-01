'use strict';

const { EducationClass, Student } = require('./education.model');
const { Lead } = require('../lead/lead.model');
const { BaseRepository } = require('../../shared/base/BaseRepository');

class EducationClassRepository extends BaseRepository {
  constructor() {
    super(EducationClass);
  }
}

class StudentRepository extends BaseRepository {
  constructor() {
    super(Student);
  }
}

class EducationLeadRepository extends BaseRepository {
  constructor() {
    super(Lead);
  }

  async softDeleteMany(filter, userId) {
    return this.model.updateMany(this._applyTenantFilter(filter), {
      $set: { isDeleted: true, deletedAt: new Date(), deletedBy: userId },
    });
  }
}

module.exports = {
  EducationClassRepository,
  StudentRepository,
  EducationLeadRepository,
};
