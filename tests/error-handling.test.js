import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db, guest } from './fixture.js';
import { client } from './helpers.js';
import { createApp } from '../server/app.js';
import { AppError, errorHandler } from '../server/errors.js';

test('Validation and missing routes return safe structured Mongolian errors', async () => {
  const response = await guest.request('POST', '/auth/login', { email: 'bad', password: '' });
  assert.equal(response.status, 400);
  assert.equal(response.data.code, 'VALIDATION_ERROR');
  assert.equal(response.data.details[0].field, 'email');
  assert.equal(response.data.requestId, response.headers['x-request-id']);
  const missing = await guest.request('GET', '/does-not-exist');
  assert.equal(missing.status, 404);
  assert.equal(missing.data.code, 'NOT_FOUND');
});
test('Unexpected database errors do not reveal internal details in API responses', async () => {
  const broken = new Proxy(db, { get(target, key) {
    if (key === 'get') return async () => { throw new Error('SQL password=private-secret'); };
    return target[key];
  } });
  const response = await client(createApp(broken)).request('GET', '/health');
  assert.equal(response.status, 500);
  assert.equal(response.data.code, 'INTERNAL_ERROR');
  assert.ok(!response.raw.includes('private-secret'));
});
test('Parser errors get friendly messages and server logs exclude raw secrets', () => {
  const logs = [];
  const handler = errorHandler({ error: value => logs.push(value) });
  const res = { locals: { requestId: 'test-id' }, status(s) { this.code = s; return this; }, json(data) { this.data = data; } };
  handler({ status: 400, type: 'entity.parse.failed', message: 'private body' }, { method: 'POST' }, res, () => {});
  assert.equal(res.data.code, 'INVALID_JSON');
  assert.ok(!JSON.stringify(res.data).includes('private body'));
  handler(new AppError(500, 'password=secret'), { method: 'GET' }, res, () => {});
  assert.equal(logs.length, 1);
  assert.ok(!JSON.stringify(logs).includes('secret'));
});
