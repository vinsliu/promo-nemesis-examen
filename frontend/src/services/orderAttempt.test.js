const { webcrypto } = require('node:crypto');
const { TextEncoder } = require('node:util');
const payload = { items: [{ productId: '507f1f77bcf86cd799439011', quantity: 1 }], shippingAddress: { street: 'private-street' }, paymentMethod: 'PayPal', shippingMethod: 'colissimo' };
beforeAll(() => { Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto }); global.TextEncoder = TextEncoder; });
beforeEach(() => { sessionStorage.clear(); jest.resetModules(); });
test('real helper retains ambiguous A across B and reload, and clears only a completed attempt', async () => {
  let { getOrderAttempt, clearOrderAttempt } = require('./orderAttempt');
  const a = await getOrderAttempt(payload, 'userA');
  const bPayload = { ...payload, items: [{ ...payload.items[0], quantity: 2 }] };
  const b = await getOrderAttempt(bPayload, 'userA'); expect(b).not.toBe(a);
  expect(sessionStorage.getItem('checkout-attempt-v2')).not.toContain('private-street');
  clearOrderAttempt(b);
  jest.resetModules(); ({ getOrderAttempt, clearOrderAttempt } = require('./orderAttempt'));
  expect(await getOrderAttempt(payload, 'userA')).toBe(a);
  const otherUser = await getOrderAttempt(payload, 'userB'); expect(otherUser).not.toBe(a);
  clearOrderAttempt(a);
  expect(await getOrderAttempt(payload, 'userA')).not.toBe(a);
});
test('prices do not change checkout identity and unresolved attempts are never silently evicted', async () => {
  const { getOrderAttempt } = require('./orderAttempt');
  const a = await getOrderAttempt(payload, 'userA');
  expect(await getOrderAttempt({ ...payload, total: 999, items: [{ ...payload.items[0], price: -10 }] }, 'userA')).toBe(a);
  for (let index = 1; index < 20; index++) await getOrderAttempt({ ...payload, shippingMethod: `attempt-${index}` }, 'userA');
  await expect(getOrderAttempt({ ...payload, shippingMethod: 'new-attempt' }, 'userA')).rejects.toThrow('Trop de tentatives');
  expect(await getOrderAttempt(payload, 'userA')).toBe(a);
});
