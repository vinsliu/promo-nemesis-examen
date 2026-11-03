const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const notificationPath = require.resolve('../services/notifications');
require(notificationPath);
require.cache[notificationPath].exports = async () => {};
const productController = require('../controllers/productController');
const controller = require('../controllers/orderController');
const lifecycle = require('../services/orderLifecycle');

// Explicit isolated test database only; never fall back to the application's MONGO_URI.
const uri = process.env.TEST_MONGO_URI;
function response() { return { code: 200, status(code) { this.code = code; return this; },
  json(body) { this.body = body; return this; }, end() { return this; } }; }
const userId = new mongoose.Types.ObjectId().toString();
function req(product, key, quantity = 1) { return { user: { userId }, headers: { 'idempotency-key': key }, body: {
  items: [{ productId: String(product._id), quantity, price: -99 }], shippingAddress: {
    street: 'rue', city: 'Paris', postalCode: '75000', country: 'France' }, paymentMethod: 'PayPal', shippingMethod: 'colissimo' } }; }
const create = async request => { const res = response(); await controller.createOrder(request, res); return res; };

test('standalone journal, stock concurrency, compensation, idempotence and recovery', { skip: !uri }, async () => {
  assert.match(uri, /\/exam_functional_verify(?:[?]|$)/, 'Use the dedicated disposable verification database');
  await mongoose.connect(uri);
  const prefix = `lifecycle-${Date.now()}`;
  const productIds = [];
  try {
    await Order.init();
    const makeProduct = async stock => {
      const product = await Product.create({ name: prefix, price: 0.1, stock, description: 'isolated test fixture' });
      productIds.push(product._id); return product;
    };
    const product = await makeProduct(1);
    const results = await Promise.all(Array.from({ length: 12 }, (_, index) => create(req(product, `${prefix}-concurrent-${index}`))));
    assert.equal(results.filter(result => result.code === 201).length, 1);
    assert.equal((await Product.findById(product._id)).stock, 0);
    const winner = results.find(result => result.code === 201).body.order;
    assert.equal(winner.idempotencyKey, undefined); assert.equal(winner.lifecycle, undefined);
    const overflow = response();
    await productController.updateProductStock({ params: { productId: String(product._id) }, body: { stock: Number.MAX_SAFE_INTEGER } }, overflow);
    assert.equal(overflow.code, 409);
    const cancel = response();
    await controller.updateOrderStatus({ params: { orderId: String(winner._id) }, body: { status: 'Annulée' } }, cancel);
    assert.equal(cancel.code, 200); assert.equal((await Product.findById(product._id)).stock, 1);
    const cancelledAgain = response();
    await controller.updateOrderStatus({ params: { orderId: String(winner._id) }, body: { status: 'Annulée' } }, cancelledAgain);
    assert.equal((await Product.findById(product._id)).stock, 1);

    const sameProduct = await makeProduct(10);
    const sameRequest = req(sameProduct, `${prefix}-idempotent`);
    const sameResults = await Promise.all(Array.from({ length: 8 }, () => create(sameRequest)));
    assert.equal(sameResults.filter(result => result.code === 201).length, 1);
    const replay = await create(sameRequest); assert.equal(replay.code, 200);
    assert.equal((await Product.findById(sameProduct._id)).stock, 9);
    sameRequest.body.items[0].quantity = 2;
    assert.equal((await create(sameRequest)).code, 409); sameRequest.body.items[0].quantity = 1;
    // A catalog price change must not alter the replayed order.
    await Product.updateOne({ _id: sameProduct._id }, { $set: { price: 99 } });
    assert.equal((await create(sameRequest)).body.order.total, 0.1);
    const removed = response();
    await controller.deleteOrder({ params: { id: String(replay.body.order._id) } }, removed);
    assert.equal(removed.code, 204); assert.equal((await Product.findById(sameProduct._id)).stock, 10);
    assert.equal((await create(sameRequest)).code, 410);

    const first = await makeProduct(5); const empty = await makeProduct(0);
    const incomplete = req(first, `${prefix}-rollback`, 2);
    incomplete.body.items.push({ productId: String(empty._id), quantity: 1 });
    assert.equal((await create(incomplete)).code, 409);
    assert.equal((await Product.findById(first._id)).stock, 5);
    assert.equal(await Product.exists({ _id: first._id, [`reservations.${(await Order.findOne({ userId, idempotencyKey: `${prefix}-rollback` }))._id}`]: { $exists: true } }), null);

    const recoveryProduct = await makeProduct(4);
    const interrupted = await Order.create({ userId, ...req(recoveryProduct, '').body,
      total: 0.1, items: [{ productId: recoveryProduct._id, quantity: 1, price: 0.1 }], lifecycle: 'creating' });
    await lifecycle.reserve(interrupted);
    assert.equal((await Product.findById(recoveryProduct._id)).stock, 3);
    await lifecycle.recoverOrders(); await lifecycle.recoverOrders();
    assert.equal((await Product.findById(recoveryProduct._id)).stock, 4);
    assert.equal((await Order.findById(interrupted._id)).lifecycle, 'failed');

    const fulfilledProduct = await makeProduct(1);
    const fulfilled = await create(req(fulfilledProduct, `${prefix}-fulfilled`));
    const orderId = String(fulfilled.body.order._id);
    const validated = response(); await controller.validateOrder({ params: { id: orderId } }, validated);
    assert.equal(validated.body.order.status, 'En cours de traitement');
    const dispatched = response(); await controller.updateOrderStatus({ params: { orderId }, body: { status: 'Expédiée' } }, dispatched);
    assert.equal(dispatched.code, 200);
    const forbidden = response(); await controller.updateOrderStatus({ params: { orderId }, body: { status: 'Annulée' } }, forbidden);
    assert.equal(forbidden.code, 409);
    const deleteShipped = response(); await controller.deleteOrder({ params: { id: orderId } }, deleteShipped);
    assert.equal(deleteShipped.code, 409); assert.equal((await Product.findById(fulfilledProduct._id)).stock, 0);
    const secretProduct = await Product.findById(fulfilledProduct._id);
    assert.equal(secretProduct.toJSON().reservations, undefined);
  } finally {
    await Order.deleteMany({ userId });
    await Product.deleteMany({ _id: { $in: productIds } });
    await mongoose.disconnect();
  }
});
