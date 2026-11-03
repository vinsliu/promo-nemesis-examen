const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../controllers/authController');
const { authenticateToken, isAdmin } = require('../middlewares/authMiddleware');
const { createAuthRateLimit } = require('../middlewares/authRateLimit');

const originalFind = User.findOne;
const originalSave = User.prototype.save;
const originalSecret = process.env.JWT_SECRET;
const id = '507f1f77bcf86cd799439011';
function response() {
  return { code: 200, headers: {}, status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }, set(name, value) { this.headers[name] = value; return this; } };
}
beforeEach(() => { process.env.JWT_SECRET = 'test-only-auth-secret'; });
afterEach(() => {
  User.findOne = originalFind;
  User.prototype.save = originalSave;
  if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
});

test('login rejects query operators and invalid bodies before a database lookup', async () => {
  User.findOne = () => { throw new Error('must not query'); };
  for (const body of [undefined, null, {}, { username: { $ne: null }, password: 'secret' },
    { username: ['admin'], password: 'secret' }, { username: 'admin', password: {} },
    { username: 'admin', password: 'a'.repeat(1025) }]) {
    const res = response(); await auth.login({ body }, res); assert.equal(res.code, 400);
  }
});

test('unknown user and incorrect password return identical responses', async () => {
  const password = await bcrypt.hash('correct', 10);
  User.findOne = async () => null;
  const absent = response(); await auth.login({ body: { username: 'absent', password: 'wrong' } }, absent);
  User.findOne = async () => ({ _id: id, username: 'existing', role: 'user', password });
  const wrong = response(); await auth.login({ body: { username: 'existing', password: 'wrong' } }, wrong);
  assert.equal(absent.code, 401); assert.equal(wrong.code, absent.code); assert.deepEqual(wrong.body, absent.body);
});

test('existing bcrypt account with short password logs in and retains frontend contract', async () => {
  const password = await bcrypt.hash('old', 10);
  User.findOne = async filter => {
    assert.deepEqual(filter, { username: 'existing' });
    return { _id: id, username: 'existing', role: 'admin', password };
  };
  const res = response(); await auth.login({ body: { username: 'existing', password: 'old' } }, res);
  assert.equal(res.code, 200); assert.equal(res.body.username, 'existing'); assert.equal(res.body.role, 'admin');
  const claims = jwt.verify(res.body.token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  assert.equal(claims.userId, id); assert.equal(claims.role, 'admin'); assert.equal(claims.exp - claims.iat, 3600);
});

test('missing JWT secret fails closed', async () => {
  delete process.env.JWT_SECRET;
  User.findOne = () => { throw new Error('must not query'); };
  const res = response(); await auth.login({ body: { username: 'existing', password: 'valid' } }, res);
  assert.equal(res.code, 503);
});

test('register rejects operators, malformed email and bcrypt-truncated passwords', async () => {
  User.findOne = () => { throw new Error('must not query'); };
  const valid = { username: 'name', email: 'a@example.com', password: 'password' };
  for (const body of [{ ...valid, username: {} }, { ...valid, email: { $ne: null } },
    { ...valid, email: 'invalid' }, { ...valid, password: 'short' },
    { ...valid, password: 'é'.repeat(37) }, null]) {
    const res = response(); await auth.register({ body }, res); assert.equal(res.code, 400);
  }
});

test('register checks both unique fields and ignores an injected admin role', async () => {
  User.findOne = async filter => {
    assert.deepEqual(filter, { $or: [{ email: 'a@example.com' }, { username: 'new' }] }); return null;
  };
  User.prototype.save = async function () {
    assert.equal(this.role, 'user'); assert.equal(this.email, 'a@example.com'); return this;
  };
  const res = response();
  await auth.register({ body: { username: 'new', email: ' a@example.com ', password: 'password', role: 'admin' } }, res);
  assert.equal(res.code, 201);
});

test('register handles existing accounts and concurrent E11000 collisions consistently', async () => {
  const body = { username: 'name', email: 'a@example.com', password: 'password' };
  User.findOne = async () => ({ _id: id });
  const existing = response(); await auth.register({ body }, existing);
  User.findOne = async () => null;
  User.prototype.save = async () => { const error = new Error('sensitive duplicate data'); error.code = 11000; throw error; };
  const race = response(); await auth.register({ body }, race);
  assert.equal(existing.code, 409); assert.equal(race.code, 409); assert.deepEqual(race.body, existing.body);
});

test('database errors never expose the input, hash or internal error', async () => {
  User.findOne = async () => { throw new Error('sensitive database details'); };
  const res = response(); await auth.login({ body: { username: 'existing', password: 'password' } }, res);
  assert.equal(res.code, 500); assert.deepEqual(res.body, { message: 'Erreur serveur' });
});

test('JWT middleware accepts valid sessions and administrator checks remain separate', () => {
  const token = jwt.sign({ userId: id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const req = { headers: { authorization: `Bearer ${token}` } }; let calls = 0;
  authenticateToken(req, response(), () => calls++); assert.equal(calls, 1); assert.equal(req.user.userId, id);
  const denied = response(); isAdmin(req, denied, () => calls++); assert.equal(denied.code, 403);
  const missing = response(); isAdmin({}, missing, () => calls++); assert.equal(missing.code, 403);
  isAdmin({ user: { role: 'admin' } }, response(), () => calls++); assert.equal(calls, 2);
});

test('JWT middleware rejects missing, malformed, expired, wrong-algorithm and invalid-claim sessions', () => {
  const sign = (claims, options = {}) => jwt.sign(claims, process.env.JWT_SECRET, options);
  const headers = [undefined, 'Basic abc', 'Bearer abc extra', 'Bearer malformed',
    `Bearer ${sign({ userId: id, role: 'user' }, { expiresIn: -1 })}`,
    `Bearer ${sign({ userId: id, role: 'admin' }, { algorithm: 'HS384' })}`,
    `Bearer ${sign({ userId: { $ne: null }, role: 'admin' })}`,
    `Bearer ${sign({ userId: id, role: 'superadmin' })}`];
  for (const authorization of headers) {
    const res = response(); authenticateToken({ headers: { authorization } }, res, () => assert.fail('must reject'));
    assert.equal(res.code, 401);
  }
});

test('rate limiter enforces quota, ignores forged forwarding headers and expires windows', () => {
  let now = 1000; const limit = createAuthRateLimit({ limit: 2, windowMs: 1000, now: () => now });
  const req = { socket: { remoteAddress: '127.0.0.1' }, headers: {} }; let calls = 0;
  limit(req, response(), () => calls++); limit(req, response(), () => calls++);
  req.headers['x-forwarded-for'] = 'other-address'; const denied = response();
  limit(req, denied, () => calls++); assert.equal(denied.code, 429); assert.equal(denied.headers['Retry-After'], '1');
  now = 2000; limit(req, response(), () => calls++); assert.equal(calls, 3);
});

test('rate limiter bounds its memory and recovers capacity after expiration', () => {
  let now = 0; const limit = createAuthRateLimit({ limit: 2, maxEntries: 1, windowMs: 1000, now: () => now });
  let calls = 0; limit({ socket: { remoteAddress: 'one' } }, response(), () => calls++);
  const denied = response(); limit({ socket: { remoteAddress: 'two' } }, denied, () => calls++);
  assert.equal(denied.code, 429); now = 1000;
  limit({ socket: { remoteAddress: 'two' } }, response(), () => calls++); assert.equal(calls, 2);
});
