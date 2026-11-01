'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const fastifyJwt = require('@fastify/jwt');
const { authenticate } = require('../src/shared/middleware/authenticate.middleware');

test('expired tokens are identified correctly with the configured JWT expiry message', async (t) => {
  const app = Fastify();
  t.after(() => app.close());
  await app.register(fastifyJwt, {
    secret: 'test-only-secret-for-authentication-regression',
    messages: { authorizationTokenExpiredMessage: 'Access token has expired' },
  });
  let handled = false;
  app.post('/api/v1/leads/distribute-batch-round-robin', { preValidation: authenticate }, async () => {
    handled = true;
    return { success: true };
  });
  const token = app.jwt.sign({ id: 'test-user', exp: Math.floor(Date.now() / 1000) - 60 });
  const response = await app.inject({ method: 'POST', url: '/api/v1/leads/distribute-batch-round-robin', headers: { authorization: `Bearer ${token}` }, payload: { mode: 'equal' } });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().message, 'Access token has expired. Please refresh your session.');
  assert.equal(handled, false);
});

test('requests without a valid access token remain blocked before assignment', async (t) => {
  const app = Fastify();
  t.after(() => app.close());
  await app.register(fastifyJwt, { secret: 'test-only-secret-for-authentication-regression' });
  app.post('/api/v1/leads/distribute-batch-round-robin', { preValidation: authenticate }, async () => assert.fail('Unauthenticated assignment must not run'));
  for (const authorization of [undefined, 'Bearer invalid-token']) {
    const response = await app.inject({ method: 'POST', url: '/api/v1/leads/distribute-batch-round-robin', headers: authorization ? { authorization } : {}, payload: { mode: 'equal' } });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().message, 'Invalid or missing authentication token.');
  }
});
