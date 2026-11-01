'use strict';

const { ValidationError } = require('../errors');

const MAX_BULK_IMPORT_ROWS = 2000;

function errorMessage(error) {
  return error?.message || 'Import failed';
}

function mobileKey(value) {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  return digits.slice(-10);
}

/**
 * Process one upload request with bounded database concurrency while preserving
 * row-level failures. Duplicate mobile numbers inside the request are rejected
 * before any writes for those duplicate rows.
 */
async function processBulkImport(rows, processor, options = {}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new ValidationError('At least one row is required for import.');
  }
  if (rows.length > MAX_BULK_IMPORT_ROWS) {
    throw new ValidationError(`A maximum of ${MAX_BULK_IMPORT_ROWS} rows can be imported at once.`);
  }

  const concurrency = Math.max(1, Math.min(Number(options.concurrency) || 8, 20));
  const errors = [];
  const duplicateIndexes = new Set();
  const firstMobileIndex = new Map();

  rows.forEach((row, index) => {
    const key = mobileKey(row?.mobile);
    if (!key) return;
    if (firstMobileIndex.has(key)) {
      duplicateIndexes.add(index);
      errors.push({
        index,
        rowNumber: index + 2,
        mobile: row?.mobile,
        code: 'DUPLICATE_IN_UPLOAD',
        message: `Duplicate mobile number in upload; first seen on row ${firstMobileIndex.get(key) + 2}.`,
      });
    } else {
      firstMobileIndex.set(key, index);
    }
  });

  const pendingIndexes = rows.map((_, index) => index).filter(index => !duplicateIndexes.has(index));
  let cursor = 0;
  let importedCount = 0;

  async function worker() {
    while (cursor < pendingIndexes.length) {
      const index = pendingIndexes[cursor++];
      try {
        await processor(rows[index], index);
        importedCount++;
      } catch (error) {
        errors.push({
          index,
          rowNumber: index + 2,
          mobile: rows[index]?.mobile,
          code: error?.errorCode || error?.code || 'IMPORT_FAILED',
          message: errorMessage(error),
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, pendingIndexes.length || 1) }, () => worker()),
  );

  errors.sort((a, b) => a.index - b.index);
  return {
    requestedCount: rows.length,
    importedCount,
    failedCount: errors.length,
    errors,
  };
}

module.exports = { MAX_BULK_IMPORT_ROWS, processBulkImport };
