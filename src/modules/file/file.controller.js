'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { FileService } = require('./file.service');
const { ValidationError } = require('../../shared/errors');

class FileController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.fileService = deps.service || new FileService(deps);
  }

  async upload(req, reply) {
    if (!req.isMultipart()) {
      throw new ValidationError('Request must be multipart/form-data');
    }

    const data = await req.file();
    if (!data) {
      throw new ValidationError('No file uploaded');
    }

    // Access non-file fields sent with multipart
    const entityType = data.fields.entityType?.value;
    const entityId = data.fields.entityId?.value;

    if (!entityType || !entityId) {
      throw new ValidationError('entityType and entityId are required fields');
    }

    const file = await this.fileService.uploadFile(
      {
        filename: data.filename,
        mimeType: data.mimetype,
        file: data.file,
      },
      { entityType, entityId },
      this.getUser(req),
    );

    return this.created(reply, file, 'File uploaded successfully');
  }

  async getByEntity(req, reply) {
    const { entityType, entityId } = req.query;
    if (!entityType || !entityId) {
      throw new ValidationError('entityType and entityId query parameters are required');
    }

    const files = await this.fileService.getFilesForEntity(entityType, entityId);
    return this.ok(reply, files);
  }

  async delete(req, reply) {
    await this.fileService.deleteFile(req.params.id, this.getUser(req));
    return this.ok(reply, null, 'File deleted successfully');
  }
}

module.exports = { FileController };
