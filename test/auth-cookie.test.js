'use strict';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/trackdeal-test';
process.env.JWT_ACCESS_SECRET ||= 'test-access-secret-that-is-at-least-32-characters';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-that-is-at-least-32-characters';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AuthController } = require('../src/modules/auth/auth.controller');

function replyDouble() {
  return {
    cookies: [],
    cleared: [],
    headers: {},
    setCookie(name, value, options) {
      this.cookies.push({ name, value, options });
      return this;
    },
    clearCookie(name, options) {
      this.cleared.push({ name, options });
      return this;
    },
    header(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.payload = payload;
      return payload;
    },
  };
}

test('login stores the refresh token in an HttpOnly cookie and omits it from JSON', async () => {
  const controller = new AuthController({
    service: {
      login: async () => ({ accessToken: 'access', refreshToken: 'refresh', user: { id: 'user-1' } }),
    },
  });
  const reply = replyDouble();

  await controller.login({ body: {}, ip: '127.0.0.1', headers: {} }, reply);

  assert.equal(reply.cookies[0].name, 'trackdeal_refresh');
  assert.equal(reply.cookies[0].value, 'refresh');
  assert.equal(reply.cookies[0].options.httpOnly, true);
  assert.equal(reply.cookies[0].options.sameSite, 'lax');
  assert.equal(reply.payload.data.refreshToken, undefined);
  assert.equal(reply.payload.data.accessToken, 'access');
  assert.equal(reply.headers['Cache-Control'], 'no-store');
});

test('refresh rotates the cookie credential supplied by the browser', async () => {
  let receivedToken;
  const controller = new AuthController({
    service: {
      refreshToken: async (token) => {
        receivedToken = token;
        return { accessToken: 'new-access', refreshToken: 'new-refresh', user: {} };
      },
    },
  });
  const reply = replyDouble();

  await controller.refresh({ cookies: { trackdeal_refresh: 'old-refresh' }, ip: '127.0.0.1', headers: {} }, reply);

  assert.equal(receivedToken, 'old-refresh');
  assert.equal(reply.cookies[0].value, 'new-refresh');
  assert.equal(reply.payload.data.refreshToken, undefined);
});

test('Capacitor sessions use a Secure SameSite=None cookie', async () => {
  const controller = new AuthController({
    service: {
      login: async () => ({ accessToken: 'access', refreshToken: 'refresh', user: {} }),
    },
  });
  const reply = replyDouble();

  await controller.login({
    body: {},
    ip: '127.0.0.1',
    headers: { origin: 'capacitor://localhost' },
  }, reply);

  assert.equal(reply.cookies[0].options.sameSite, 'none');
  assert.equal(reply.cookies[0].options.secure, true);
});

test('logout revokes the cookie token and expires the cookie', async () => {
  let receivedToken;
  const controller = new AuthController({
    service: {
      logout: async (token) => { receivedToken = token; },
    },
  });
  const reply = replyDouble();

  await controller.logout({ cookies: { trackdeal_refresh: 'refresh' }, ip: '127.0.0.1', headers: {} }, reply);

  assert.equal(receivedToken, 'refresh');
  assert.equal(reply.cleared[0].name, 'trackdeal_refresh');
});
