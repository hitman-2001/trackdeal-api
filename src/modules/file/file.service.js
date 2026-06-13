'use strict';

const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const crypto = require('crypto');
const { BaseService } = require('../../shared/base/BaseService');
const { FileRepository } = require('./file.repository');
const { AUDIT_ACTIONS } = require('../../shared/constants/app.constants');

class FileService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.fileRepository = deps.fileRepository || new FileRepository();
    this.repository = this.fileRepository;
    
    // Ensure the uploads directory exists
    this.uploadDir = deps.uploadDir || path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Save an uploaded file from a stream.
   *
   * @param {object} fileStreamData - { filename, mimeType, file (ReadableStream) }
   * @param {object} entityInfo     - { entityType, entityId }
   * @param {object} actor          - User acting
   * @returns {Promise<File>}
   */
  async uploadFile(fileStreamData, entityInfo, actor) {
    const { filename: originalName, mimeType, file } = fileStreamData;
    const { entityType, entityId } = entityInfo;

    // Generate a unique safe filename
    const fileExt = path.extname(originalName);
    const uniqueName = `${crypto.randomBytes(16).toString('hex')}${fileExt}`;
    const storagePath = path.join(this.uploadDir, uniqueName);

    // Stream and save file
    const writeStream = fs.createWriteStream(storagePath);
    await pipeline(file, writeStream);

    // Read saved file size
    const stats = fs.statSync(storagePath);
    const sizeBytes = stats.size;

    const fileDoc = await this.fileRepository.create({
      originalName,
      filename: uniqueName,
      mimeType,
      sizeBytes,
      storagePath: `/uploads/${uniqueName}`, // Web accessible or relative path
      storageType: 'local',
      entityType,
      entityId,
      createdBy: actor.id,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: 'File',
      entityId: fileDoc.id,
      userId: actor.id,
      description: `Uploaded file '${originalName}' for ${entityType} '${entityId}'`,
      newValues: fileDoc.toObject(),
    });

    return fileDoc;
  }

  /**
   * Delete a file (from disk and database).
   */
  async deleteFile(id, actor) {
    const fileDoc = await this.fileRepository.findByIdOrFail(id, 'File');
    
    // Soft delete in DB
    await this.fileRepository.softDelete(id, actor.id);

    // Attempt to delete physical file from disk
    const absoluteDiskPath = path.join(process.cwd(), fileDoc.storagePath);
    if (fs.existsSync(absoluteDiskPath)) {
      try {
        fs.unlinkSync(absoluteDiskPath);
      } catch (err) {
        this.logger.error({ err, absoluteDiskPath }, 'Failed to delete file from disk');
      }
    }

    await this.logAudit({
      action: AUDIT_ACTIONS.DELETE,
      entity: 'File',
      entityId: id,
      userId: actor.id,
      description: `Deleted file '${fileDoc.originalName}'`,
    });
  }

  /**
   * Find files by entity.
   */
  async getFilesForEntity(entityType, entityId) {
    return this.fileRepository.findByEntity(entityType, entityId);
  }
}

module.exports = { FileService };
