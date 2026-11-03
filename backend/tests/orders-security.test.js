const { test, beforeEach, afterEach, after } = require('node:test');
const assert = require('node:assert/strict');
const Product = require('../models/Product');
const Order = require('../models/Order');
// Replace the delivery boundary so tests can never send a real notification.
const notificationPath = require.resolve('../services/notifications');
const originalNotify = require(notificationPath);
after(() => { require.cache[notificationPath].exports = originalNotify; });
require.cache[notificationPath].exports = async () => {};
const orders = require('../controllers/orderController');
const products = require('../controllers/productController');
const original = { find: Product.find, findById: Product.findById, productSave: Product.prototype.save,
  orderSave: Order.prototype.save, update: Order.findByIdAndUpdate, orderFind: Order.find,
  orderFindOne: Order.findOne, orderUpdate: Order.findOneAndUpdate, productUpdate: Product.findOneAndUpdate, productByIdUpdate: Product.findByIdAndUpdate };
beforeEach(() => { Order.findOne = async () => null; });
afterEach(() => { Product.find = original.find; Product.findById = original.findById;
  Product.prototype.save = original.productSave; Order.prototype.save = original.orderSave;
  Order.findByIdAndUpdate = original.update; Order.find = original.orderFind;
  Order.findOne = original.orderFindOne; Order.findOneAndUpdate = original.orderUpdate;
  Product.findOneAndUpdate = original.productUpdate; Product.findByIdAndUpdate = original.productByIdUpdate; });
const id = '507f1f77bcf86cd799439011';
function response() { return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
function request() { return { user: { userId: id }, headers: { 'idempotency-key': 'test-checkout-attempt-123' }, body: { items: [{ productId: id, quantity: 3, price: -999 }],
  shippingAddress: { street: ' rue ', city: ' Paris ', postalCode: ' 75000 ', country: ' France ' },
  paymentMethod: 'Carte bancaire', shippingMethod: 'colissimo' } }; }

test('order ignores forged prices and total, reads catalog price and normalizes address', async () => {
  Product.find = async filter => { assert.deepEqual(filter, { _id: { $in: [id] } }); return [{ _id: id, price: 0.1 }]; };
  let saved; Order.prototype.save = async function () { saved = this; return this; };
  Product.findOneAndUpdate = async () => ({});
  Order.findOneAndUpdate = async () => { saved.lifecycle = 'active'; return saved; };
  const req = request(); req.body.total = -100000; const res = response(); await orders.createOrder(req, res);
  assert.equal(res.code, 201); assert.equal(res.body.order.total, 0.3); assert.equal(res.body.order.items[0].price, 0.1);
  assert.equal(res.body.order.shippingAddress.street, 'rue'); assert.equal(res.body.order.shippingAddress.country, 'France');
});

test('invalid items, duplicate ids and excessive lines are refused before database calls', async () => {
  Product.find = () => assert.fail('must not query');
  for (const items of [null, [], [null], [{ productId: { $ne: null }, quantity: 1 }],
    [{ productId: id, quantity: '1' }], [{ productId: id, quantity: 1.5 }],
    [{ productId: id, quantity: 0 }], [{ productId: id, quantity: Number.MAX_SAFE_INTEGER + 1 }],
    [{ productId: id, quantity: 1 }, { productId: id.toUpperCase(), quantity: 2 }],
    Array.from({ length: 101 }, () => ({ productId: id, quantity: 1 }))]) {
    const req = request(); req.body.items = items; const res = response(); await orders.createOrder(req, res); assert.equal(res.code, 400);
  }
});

test('whitespace, operator and oversized addresses and invalid methods are rejected before querying', async () => {
  Product.find = () => assert.fail('must not query');
  for (const patch of [{ shippingAddress: { ...request().body.shippingAddress, street: '   ' } },
    { shippingAddress: { ...request().body.shippingAddress, city: { $ne: null } } },
    { shippingAddress: { ...request().body.shippingAddress, postalCode: 'x'.repeat(21) } },
    { paymentMethod: ['PayPal'] }, { shippingMethod: 'invalid' }]) {
    const req = request(); Object.assign(req.body, patch); const res = response(); await orders.createOrder(req, res); assert.equal(res.code, 400);
  }
});

test('unknown product and unsafe catalog amounts do not save an order', async () => {
  Order.prototype.save = () => assert.fail('must not save');
  for (const list of [[], [{ _id: id, price: -1 }], [{ _id: id, price: Infinity }],
    [{ _id: id, price: Number.MAX_SAFE_INTEGER }], [{ _id: id, price: '1' }]]) {
    Product.find = async () => list; const res = response(); await orders.createOrder(request(), res); assert.equal(res.code, 400);
  }
  Product.find = async () => [{ _id: id, price: 1 }]; const req = request(); req.body.items[0].quantity = Number.MAX_SAFE_INTEGER;
  const res = response(); await orders.createOrder(req, res); assert.equal(res.code, 400);
});

test('order schema rejects negative prices and fractional quantities', () => {
  const order = new Order({ userId: id, ...request().body, total: 0 });
  order.items[0].price = -1; order.items[0].quantity = 1.5;
  const error = order.validateSync(); assert.ok(error.errors['items.0.price']); assert.ok(error.errors['items.0.quantity']);
});

test('stock accepts numeric zero and UI string zero as integers', async () => {
  for (const stock of [0, '0', '12', 12]) {
    const product = new Product({ name: 'test', price: 1, description: 'test', stock: 5 });
    Product.findOneAndUpdate = async (filter, update, options) => {
      assert.equal(options.runValidators, true); product.stock = update.$set.stock; return product;
    };
    const res = response(); await products.updateProductStock({ params: { productId: id }, body: { stock } }, res);
    assert.equal(res.code, 200); assert.equal(res.body.product.stock, Number(stock));
  }
});

test('stock rejects non-integers, invalid types and ids before database access', async () => {
  Product.findOneAndUpdate = () => assert.fail('must not query');
  for (const stock of [null, undefined, '', ' ', true, [], {}, NaN, Infinity, -1, 1.5, '1.5', '-1', Number.MAX_SAFE_INTEGER + 1]) {
    const res = response(); await products.updateProductStock({ params: { productId: id }, body: { stock } }, res); assert.equal(res.code, 400);
  }
  const res = response(); await products.updateProductStock({ params: { productId: 'bad' }, body: { stock: 0 } }, res); assert.equal(res.code, 400);
});

test('status accepts only schema values and enables update validators', async () => {
  Order.findOne = async () => ({ _id: id, status: 'En cours de traitement' });
  Order.findOneAndUpdate = async (filter, update, options) => {
    assert.equal(filter._id, id); assert.equal(update.$set.status, 'Expédiée'); assert.equal(options.runValidators, true); return { _id: id };
  };
  const lifecycle = require('../services/orderLifecycle');
  const originalDiscard = lifecycle.discardMarkers; lifecycle.discardMarkers = async () => {};
  try {
  const good = response(); await orders.updateOrderStatus({ params: { orderId: id }, body: { status: 'Expédiée' } }, good); assert.equal(good.code, 200);
  Order.findOneAndUpdate = () => assert.fail('must not update');
  for (const status of ['unexpected', { $ne: null }, '', ['Expédiée']]) {
    const res = response(); await orders.updateOrderStatus({ params: { orderId: id }, body: { status } }, res); assert.equal(res.code, 400);
  }
  } finally { lifecycle.discardMarkers = originalDiscard; }
});

test('catalog/order read failures produce controlled responses', async () => {
  Product.find = async () => { throw new Error('private db details'); };
  Order.find = async () => { throw new Error('private db details'); };
  for (const handler of [products.getProducts, orders.getOrders]) {
    const res = response(); await handler({}, res); assert.equal(res.code, 500); assert.ok(!JSON.stringify(res.body).includes('private'));
  }
});

test('DELETE order route includes administrator guard', () => {
  const { isAdmin } = require('../middlewares/authMiddleware');
  const router = require('../routes/orderRoutes');
  const route = router.stack.find(layer => layer.route?.methods.delete).route;
  assert.equal(route.stack[1].handle, isAdmin);
  const res = response(); route.stack[1].handle({ user: { role: 'user' } }, res, () => assert.fail('must deny'));
  assert.equal(res.code, 403);
});
