const Order = require('../models/Order');
const Product = require('../models/Product');

const visible = { $or: [{ lifecycle: 'active' }, { lifecycle: { $exists: false } }] };
const transitions = {
  'En attente': ['En cours de traitement', 'Annulée'],
  'En cours de traitement': ['Expédiée', 'Annulée'],
  'Expédiée': ['Délivrée'], 'Délivrée': [], 'Annulée': [],
};
function publicOrder(order) {
  const value = typeof order.toObject === 'function' ? order.toObject() : { ...order };
  for (const key of ['idempotencyKey', 'requestHash', 'lifecycle', 'releaseTarget', 'failureMessage']) delete value[key];
  return value;
}
async function reserve(order) {
  for (const item of order.items) {
    const path = `reservations.${order._id}`;
    const product = await Product.findOneAndUpdate({ _id: item.productId, stock: { $gte: item.quantity },
      [path]: { $exists: false } }, { $inc: { stock: -item.quantity }, $set: { [path]: item.quantity } }, { new: true });
    if (!product) throw Object.assign(new Error('Stock insuffisant pour un produit demandé.'), { status: 409 });
  }
}
// Marker and stock change are in the same product document: compensation is repeatable.
async function release(order) {
  for (const item of order.items) {
    const path = `reservations.${order._id}`;
    await Product.updateOne({ _id: item.productId, [path]: item.quantity, stock: { $lte: Number.MAX_SAFE_INTEGER - item.quantity } },
      { $inc: { stock: item.quantity }, $unset: { [path]: '' } });
    if (await Product.exists({ _id: item.productId, [path]: item.quantity })) {
      throw new Error('Restitution du stock impossible sans dépassement numérique');
    }
  }
  const completed = await Order.findOneAndUpdate({ _id: order._id, lifecycle: 'releasing' },
    { $set: { lifecycle: order.releaseTarget || 'failed' }, $unset: { releaseTarget: '' } }, { new: true });
  return completed || Order.findById(order._id);
}
async function discardMarkers(order) {
  for (const item of order.items) {
    await Product.updateOne({ _id: item.productId }, { $unset: { [`reservations.${order._id}`]: '' } });
  }
}
// Run before listening, with exactly one backend instance. Never recover live requests.
async function recoverOrders() {
  const unfinished = await Order.find({ lifecycle: { $in: ['creating', 'releasing'] } });
  for (let order of unfinished) {
    if (order.lifecycle === 'creating') {
      order = await Order.findOneAndUpdate({ _id: order._id, lifecycle: 'creating' },
        { $set: { lifecycle: 'releasing', releaseTarget: 'failed', failureMessage: 'Création interrompue ; veuillez utiliser une nouvelle tentative.' } }, { new: true });
    }
    if (order) await release(order);
  }
  // Recover cleanup interrupted after a terminal transition (never refund dispatched goods).
  const terminal = await Order.find({ lifecycle: 'active', status: { $in: ['Expédiée', 'Délivrée'] } });
  for (const order of terminal) await discardMarkers(order);
}
module.exports = { visible, transitions, publicOrder, reserve, release, discardMarkers, recoverOrders };
