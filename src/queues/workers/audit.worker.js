'use strict';

const { auditService } = require('../../modules/audit/audit.service');

/**
 * BullMQ Job Processor for processing audits in background.
 */
async function processAuditJob(job) {
  console.log(`[Queue:audit] Processing audit job ${job.id}`);
  await auditService.saveDirect(job.data);
  return { success: true };
}

module.exports = { processAuditJob };
