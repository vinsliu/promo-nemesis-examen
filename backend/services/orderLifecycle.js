/**
 * @module services/orderLifecycle
 */
const Order = require('../models/Order');
const Product = require('../models/Product');

/** Filtre Mongo des commandes visibles (cycle de vie actif). @type {object} */
const visible = { $or: [{ lifecycle: 'active' }, { lifecycle: { $exists: false } }] };
/** Transitions de statut autorisées, par statut courant. @type {Object<string,string[]>} */
const transitions = {
  'En attente': ['En cours de traitement', 'Annulée'],
  'En cours de traitement': ['Expédiée', 'Annulée'],
  'Expédiée': ['Délivrée'], 'Délivrée': [], 'Annulée': [],
};
/**
 * Retire les champs internes (clé d'idempotence, cycle de vie…) avant d'envoyer une commande au client.
 * @param {object} order - Document Mongoose ou objet simple.
 * @returns {object}
 */
function publicOrder(order) {
  const value = typeof order.toObject === 'function' ? order.toObject() : { ...order };
  for (const key of ['idempotencyKey', 'requestHash', 'lifecycle', 'releaseTarget', 'failureMessage']) delete value[key];
  return value;
}
/**
 * Réserve le stock de chaque ligne, de façon atomique par produit.
 * @param {object} order
 * @throws {Error} Erreur `status: 409` si le stock est insuffisant.
 * @returns {Promise<void>}
 */
async function reserve(order) {
  for (const item of order.items) {
    const path = `reservations.${order._id}`;
    const product = await Product.findOneAndUpdate({ _id: item.productId, stock: { $gte: item.quantity },
      [path]: { $exists: false } }, { $inc: { stock: -item.quantity }, $set: { [path]: item.quantity } }, { new: true });
    if (!product) throw Object.assign(new Error('Stock insuffisant pour un produit demandé.'), { status: 409 });
  }
}
// Marker and stock change are in the same product document: compensation is repeatable.
/**
 * Restitue le stock réservé (opération répétable) puis termine le cycle de vie de la commande.
 * @param {object} order - Commande au cycle de vie `releasing`.
 * @returns {Promise<object>} La commande mise à jour.
 */
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
/**
 * Supprime les marqueurs de réservation d'une commande expédiée (le stock n'est jamais rendu).
 * @param {object} order
 * @returns {Promise<void>}
 */
async function discardMarkers(order) {
  for (const item of order.items) {
    await Product.updateOne({ _id: item.productId }, { $unset: { [`reservations.${order._id}`]: '' } });
  }
}
// Run before listening, with exactly one backend instance. Never recover live requests.
/**
 * Termine les commandes interrompues. À lancer avant l'écoute, avec une seule instance.
 * @returns {Promise<void>}
 */
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
