const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../controllers/authController');
const uri = process.env.TEST_MONGO_URI;
function response() { return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
test('case-insensitive usernames preserve legacy accounts and enforce uniqueness in concurrent registrations', { skip: !uri }, async () => {
  assert.match(uri, /\/exam_functional_verify(?:[?]|$)/);
  await mongoose.connect(uri); const prefix = `Case${Date.now()}`;
  const secret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'integration-only-secret';
  const emails = [];
  try {
    await User.init();
    const legacyEmail = `${prefix}@example.test`; emails.push(legacyEmail);
    await User.collection.insertOne({ username: `${prefix}Legacy`, email: legacyEmail,
      password: await bcrypt.hash('old', 10), role: 'user' });
    for (const username of [`${prefix}Legacy`.toLowerCase(), `${prefix}Legacy`.toUpperCase()]) {
      const result = response(); await auth.login({ body: { username, password: 'old' } }, result);
      assert.equal(result.code, 200); assert.equal(result.body.username, `${prefix}Legacy`);
    }
    const body = { username: `${prefix}legacy`, email: `${prefix}-duplicate@example.test`, password: 'password' };
    emails.push(body.email); const duplicate = response(); await auth.register({ body }, duplicate); assert.equal(duplicate.code, 409);
    const registration = async (username, email) => { emails.push(email); const result = response(); await auth.register({ body: { username, email, password: 'password' } }, result); return result; };
    const results = await Promise.all([registration(`${prefix}New`, `${prefix}-one@example.test`), registration(`${prefix}NEW`, `${prefix}-two@example.test`)]);
    assert.deepEqual(results.map(result => result.code).sort(), [201, 409]);
  } finally {
    await User.deleteMany({ email: { $in: emails } }); await mongoose.disconnect();
    if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret;
  }
});
