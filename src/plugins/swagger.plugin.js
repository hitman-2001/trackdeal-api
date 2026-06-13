'use strict';

const fp = require('fastify-plugin');
const swagger = require('@fastify/swagger');
const swaggerUi = require('@fastify/swagger-ui');
const { loadEnv } = require('../config/env.config');

/**
 * Swagger / OpenAPI Documentation Plugin
 * @param {import('fastify').FastifyInstance} fastify
 */
async function swaggerPlugin(fastify) {
  const env = loadEnv();

  if (!env.SWAGGER_ENABLED) return;

  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Track Deal API',
        description: 'Real Estate Broker CRM — API Documentation',
        version: '1.0.0',
        contact: {
          name: 'Track Deal Support',
          email: 'support@trackdeal.in',
        },
      },
      servers: [
        {
          url: `http://localhost:${env.PORT}${env.API_PREFIX}`,
          description: 'Development',
        },
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT access token. Obtain from POST /auth/login',
          },
        },
      },
      security: [{ BearerAuth: [] }],
      tags: [
        { name: 'Auth', description: 'Authentication endpoints' },
        { name: 'Users', description: 'User management' },
        { name: 'Roles', description: 'RBAC role management' },
        { name: 'Leads', description: 'Lead lifecycle management' },
        { name: 'Tasks', description: 'Tasks, Activities & Reminders operational engine' },
        { name: 'Customers', description: 'Customer management' },
        { name: 'Sellers', description: 'Seller management' },
        { name: 'Properties', description: 'Property management' },
        { name: 'Projects', description: 'Project management' },
        { name: 'Site Visits', description: 'Site visit scheduling & tracking' },
        { name: 'Deals', description: 'Deal management & negotiations' },
        { name: 'Brokerage', description: 'Commission calculations & settlements' },
        { name: 'Agreements', description: 'Agreement & contract management' },
        { name: 'Invoices', description: 'Invoice & payment management' },
        { name: 'Notifications', description: 'Notification management' },
        { name: 'Files', description: 'File uploads & management' },
        { name: 'Reports', description: 'Analytics & reporting' },
        { name: 'Dashboard', description: 'Dashboard aggregations' },
        { name: 'Audit', description: 'Audit log access' },
        { name: 'Settings', description: 'System configuration' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: env.SWAGGER_PREFIX,
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      persistAuthorization: true,
    },
  });
}

module.exports = fp(swaggerPlugin, { name: 'swagger-plugin' });
