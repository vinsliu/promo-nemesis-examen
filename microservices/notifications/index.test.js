const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApp } = require('./index');

const baseEnv = {
  INTERNAL_API_TOKEN: 'test-internal-secret',
  EMAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 'fake-api-key',
  NOTIFICATION_TEST_EMAIL: 'owner@example.com',
};
const payload = { to: 'client@example.com', subject: 'Commande', text: 'Commande enregistrée' };

async function run(t, overrides = {}, options = {}) {
  const server = createApp({ env: { ...baseEnv, ...overrides }, ...options }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return (body = payload, token = baseEnv.INTERNAL_API_TOKEN) => fetch(`http://127.0.0.1:${server.address().port}/notify`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  });
}

test('Refuse les appels non autorisés sans contacter Resend', async t => {
  let called = false;
  const send = await run(t, {}, { fetchEmail: async () => { called = true; } });
  assert.equal((await send(payload, 'wrong')).status, 401);
  assert.equal(called, false);
});
test('Refuse tout envoi si le secret interne est absent', async t => {
  const send = await run(t, { INTERNAL_API_TOKEN: '' });
  assert.equal((await send()).status, 503);
});
test('Valide les entrées avant de contacter le fournisseur', async t => {
  const send = await run(t, {}, { fetchEmail: () => { throw new Error('unexpected call'); } });
  assert.equal((await send({ subject: '', text: 'Test' })).status, 400);
  assert.equal((await send({ subject: 'Test', text: 'a'.repeat(10001) })).status, 400);
});
test('Redirige Resend uniquement vers le destinataire de test', async t => {
  let sent;
  const send = await run(t, {}, { fetchEmail: async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.headers.Authorization, 'Bearer fake-api-key');
    sent = JSON.parse(options.body);
    return { ok: true };
  } });
  assert.equal((await send()).status, 200);
  assert.deepEqual(sent.to, ['owner@example.com']);
  assert.match(sent.from, /onboarding@resend.dev/);
  assert.equal(sent.subject, payload.subject);
});
test('Ne divulgue pas les erreurs du fournisseur', async t => {
  const send = await run(t, {}, { fetchEmail: async () => { throw new Error('secret-provider-detail'); } });
  const response = await send();
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /secret-provider-detail|fake-api-key/);
});
test('Traite un rejet Resend comme un échec', async t => {
  const send = await run(t, {}, { fetchEmail: async () => ({ ok: false }) });
  assert.equal((await send()).status, 502);
});
test('Conserve Nodemailer et le destinataire demandé en mode SMTP', async t => {
  let sent;
  const send = await run(t, { EMAIL_PROVIDER: 'smtp', EMAIL_USER: 'sender@example.com', EMAIL_APPLICATION_PASSWORD: 'fake-smtp' }, {
    createTransport: options => {
      assert.equal(options.service, 'gmail');
      return { sendMail: async mail => { sent = mail; } };
    },
    fetchEmail: () => { throw new Error('Resend must not be called'); },
  });
  assert.equal((await send()).status, 200);
  assert.equal(sent.to, payload.to);
  assert.equal(sent.from, 'sender@example.com');
});
test('Refuse un fournisseur ou une configuration Resend incorrecte', async t => {
  const unknown = await run(t, { EMAIL_PROVIDER: 'invalid' });
  assert.equal((await unknown()).status, 503);
  const missing = await run(t, { RESEND_API_KEY: '' });
  assert.equal((await missing()).status, 503);
});

test('La gateway refuse les appels anonymes et transmet les notifications authentifiées', async t => {
  let calls = 0;
  const notifications = createApp({ env: baseEnv, fetchEmail: async () => { calls++; return { ok: true }; } }).listen(0, '127.0.0.1');
  await once(notifications, 'listening');
  t.after(() => new Promise(resolve => { notifications.close(resolve); notifications.closeAllConnections(); }));
  const previousToken = process.env.INTERNAL_API_TOKEN;
  const previousURL = process.env.NOTIFI_SERVICE_URL;
  process.env.INTERNAL_API_TOKEN = baseEnv.INTERNAL_API_TOKEN;
  process.env.NOTIFI_SERVICE_URL = `http://127.0.0.1:${notifications.address().port}`;
  t.after(() => {
    if (previousToken === undefined) delete process.env.INTERNAL_API_TOKEN;
    else process.env.INTERNAL_API_TOKEN = previousToken;
    if (previousURL === undefined) delete process.env.NOTIFI_SERVICE_URL;
    else process.env.NOTIFI_SERVICE_URL = previousURL;
  });
  const express = require('express');
  const gatewayApp = express();
  gatewayApp.use(express.json());
  gatewayApp.use('/notify', require('../../gateway/routes/notifi'));
  const gateway = gatewayApp.listen(0, '127.0.0.1');
  await once(gateway, 'listening');
  t.after(() => new Promise(resolve => { gateway.close(resolve); gateway.closeAllConnections(); }));
  const url = `http://127.0.0.1:${gateway.address().port}/notify`;
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
  assert.equal((await fetch(url, options)).status, 401);
  assert.equal(calls, 0);
  options.headers.Authorization = `Bearer ${baseEnv.INTERNAL_API_TOKEN}`;
  assert.equal((await fetch(url, options)).status, 200);
  assert.equal(calls, 1);
});
