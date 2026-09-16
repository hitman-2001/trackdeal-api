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
}

module.exports = {
  EducationClassRepository,
  StudentRepository,
  EducationLeadRepository,
};
