const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { once } = require('node:events');
const express = require('express');
const { createLogger, requestLogging, errorHandler } = require('../logger');

function capture(level = 'trace') {
  let output = '';
  const destination = new Writable({ write(chunk, encoding, done) { output += chunk; done(); } });
  return { logger: createLogger({ level, destination }), read: () => output.trim().split('\n').filter(Boolean).map(JSON.parse), raw: () => output };
}

test('Pino emits structured logs, filters levels and redacts sensitive structured fields', () => {
  const logs = capture('warn');
  logs.logger.info('not emitted');
  logs.logger.warn({ password: 'password-sentinel', token: 'token-sentinel', user: { email: 'mail-sentinel' } }, 'controlled event');
  assert.equal(logs.read().length, 1);
  assert.equal(logs.read()[0].service, 'backend');
  assert.equal(logs.read()[0].level, 40);
  for (const secret of ['password-sentinel', 'token-sentinel', 'mail-sentinel']) assert.ok(!logs.raw().includes(secret));
});

test('HTTP logs correlate server IDs and exclude headers, payloads, query strings and raw exceptions', async t => {
  const logs = capture();
  const app = express();
  app.use(requestLogging(logs.logger));
  app.use(express.json());
  app.post('/success/:id', (req, res) => res.json({ ok: true }));
  app.get('/denied', (req, res) => res.sendStatus(403));
  app.get('/error', () => { throw new Error('exception-sentinel password=secret'); });
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  const headers = { 'content-type': 'application/json', authorization: 'Bearer auth-sentinel', cookie: 'cookie-sentinel', 'x-request-id': 'forged-sentinel' };
  const success = await fetch(`${url}/success/path-sentinel?token=query-sentinel`, { method: 'POST', headers, body: JSON.stringify({ password: 'body-sentinel', email: 'email-sentinel' }) });
  assert.equal(success.status, 200);
  const id = success.headers.get('x-request-id');
  assert.match(id, /^[a-f\d-]{36}$/);
  assert.equal((await fetch(`${url}/denied`, { headers })).status, 403);
  assert.equal((await fetch(`${url}/error`, { headers })).status, 500);
  const malformed = await fetch(`${url}/success/anything`, { method: 'POST', headers, body: '{"bad":"parse-sentinel"' });
  assert.equal(malformed.status, 400);
  await new Promise(resolve => setImmediate(resolve));
  const entries = logs.read();
  assert.equal(entries.length, 4);
  assert.equal(entries[0].reqId, id);
  assert.equal(entries[0].route, '/success/:id');
  assert.deepEqual(entries.map(entry => entry.res.statusCode), [200, 403, 500, 400]);
  assert.deepEqual(entries.map(entry => entry.level), [30, 40, 50, 40]);
  assert.equal(new Set(entries.map(entry => entry.reqId)).size, 4);
  for (const secret of ['auth-sentinel', 'cookie-sentinel', 'forged-sentinel', 'body-sentinel', 'email-sentinel', 'path-sentinel', 'query-sentinel', 'exception-sentinel', 'parse-sentinel']) {
    assert.ok(!logs.raw().includes(secret), `Sensitive data leaked: ${secret}`);
  }
});
