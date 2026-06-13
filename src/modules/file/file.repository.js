'use strict';

const { File } = require('./file.model');
const { BaseRepository } = require('../../shared/base/BaseRepository');

class FileRepository extends BaseRepository {
  constructor() {
    super(File);
  }

  async findByEntity(entityType, entityId) {
    return this.findMany({ entityType, entityId, isDeleted: false });
  }
}

module.exports = { FileRepository };
