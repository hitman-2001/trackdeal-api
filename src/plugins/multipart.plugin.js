'use strict';

const fp = require('fastify-plugin');
const multipart = require('@fastify/multipart');

/**
 * Configure Fastify Multipart plugin for file uploads.
 */
async function multipartPlugin(fastify, opts) {
  await fastify.register(multipart, {
    limits: {
      fieldNameSize: 100, // Max field name size in bytes
      fieldSize: 1000000, // Max field value size in bytes (1MB)
      fields: 10,         // Max number of non-file fields
      fileSize: 10485760, // Max file size in bytes (10MB)
      files: 5,           // Max number of file fields
      headerPairs: 2000,  // Max number of header key=>value pairs
    },
  });
}

module.exports = fp(multipartPlugin);
