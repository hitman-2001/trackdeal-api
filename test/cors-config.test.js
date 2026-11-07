'use strict';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/trackdeal-test';
process.env.JWT_ACCESS_SECRET ||= 'test-access-secret-that-is-at-least-32-characters';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-that-is-at-least-32-characters';

const test = require('node:test');
const assert = require('node:assert/strict');
const { corsConfig } = require('../src/config/cors.config');

function isAllowed(origin) {
  return new Promise((resolve) => {
    corsConfig.origin(origin, (error, allowed) => resolve({ error, allowed }));
  });
}

test('CORS accepts exact TrackDeal subdomains and local app origins', async () => {
  assert.equal((await isAllowed('https://app.trackdeal.in')).allowed, true);
  assert.equal((await isAllowed('capacitor://localhost')).allowed, true);
  assert.equal((await isAllowed('http://127.0.0.1:5173')).allowed, true);
});

test('CORS rejects lookalike TrackDeal and localhost hostnames', async () => {
  assert.ok((await isAllowed('https://eviltrackdeal.in')).error);
  assert.ok((await isAllowed('https://localhost.attacker.example')).error);
  assert.ok((await isAllowed('https://evil-localhost:443')).error);
});
