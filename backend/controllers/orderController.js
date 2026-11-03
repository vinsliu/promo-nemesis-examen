/**
 * @module controllers/orderController
 */
const { logger } = require('../logger');
const { createHash } = require('node:crypto');
const lifecycle = require('../services/orderLifecycle');
const notify = require('../services/notifications');
const audit = require('../audit');
const Order = require('../models/Order');
const Product = require('../models/Product');
const validId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);

/**
 * Crée une commande de façon idempotente (en-tête `Idempotency-Key` obligatoire).
 * Les prix viennent du catalogue, jamais du client ; le stock est réservé de façon atomique.
 * @param {express.Request} req - `body` : `{ items, shippingAddress, paymentMethod, shippingMethod }`.
 * @param {express.Response} res - 201 créée, 200 rejouée, 409 stock insuffisant ou clé réutilisée.
 * @returns {Promise<void>}
 */
exports.createOrder = async (req, res) => {
  const { items, shippingAddress, paymentMethod, shippingMethod } = req.body || {};
  if (!Array.isArray(items) || items.length === 0 || items.length > 100 ||
      items.some(item => !item || !validId(item.productId) ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1)) {
    return res.status(400).json({ message: 'Produits et quantités entières positives requis (100 lignes maximum).' });
  }
  // Reject duplicate lines rather than allowing quantity limits to be bypassed.
  const ids = items.map(item => item.productId.toLowerCase());
  if (new Set(ids).size !== ids.length) {
    return res.status(400).json({ message: 'Un produit ne peut apparaître que sur une seule ligne.' });
  }
  const addressLimits = { street: 200, city: 100, postalCode: 20, country: 100 };
  const address = {};
  for (const [field, limit] of Object.entries(addressLimits)) {
    const value = shippingAddress?.[field];
    if (typeof value !== 'string' || !value.trim() || value.length > limit) {
      return res.status(400).json({ message: 'Adresse de livraison invalide.' });
    }
    address[field] = value.trim();
  }
  if (!['Carte bancaire', 'PayPal', 'Virement'].includes(paymentMethod) ||
      !['colissimo', 'chronopost'].includes(shippingMethod)) {
    return res.status(400).json({ message: 'Méthodes de paiement et de livraison invalides.' });
  }

  const key = req.get ? req.get('Idempotency-Key') : req.headers?.['idempotency-key'];
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(key)) {
    return res.status(400).json({ message: "Une clé Idempotency-Key valide est requise." });
  }
  const requestHash = createHash('sha256').update(JSON.stringify({
    items: items.map(item => ({ productId: item.productId.toLowerCase(), quantity: item.quantity }))
      .sort((a, b) => a.productId.localeCompare(b.productId)),
    shippingAddress: address, paymentMethod, shippingMethod,
  })).digest('hex');
  const replay = existing => {
    if (existing.requestHash !== requestHash) return res.status(409).json({ message: 'Cette clé correspond à une autre commande.' });
    if (existing.lifecycle === 'deleted') return res.status(410).json({ message: 'Cette commande a été supprimée.' });
    if (existing.lifecycle === 'failed') return res.status(409).json({ message: existing.failureMessage || 'Cette tentative a échoué ; veuillez en créer une nouvelle.' });
    if (existing.lifecycle !== 'active') return res.status(409).json({ code: 'ORDER_PENDING', message: 'Commande en cours ; réessayez avec la même clé.' });
    return res.status(200).json({ message: 'Commande déjà créée', order: lifecycle.publicOrder(existing) });
  };
  let pendingOrder;
  try {
    const existing = await Order.findOne({ userId: req.user.userId, idempotencyKey: key });
    if (existing) return replay(existing);
    const products = await Product.find({ _id: { $in: ids } });
    const byId = new Map(products.map(product => [String(product._id), product]));
    const orderDetails = [];
    let totalCents = 0;
    for (const item of items) {
      const product = byId.get(item.productId.toLowerCase());
      if (!product) return res.status(400).json({ message: 'Un produit demandé est introuvable.' });
      const cents = Math.round(product.price * 100);
      if (typeof product.price !== 'number' || !Number.isFinite(product.price) || product.price < 0 ||
          !Number.isSafeInteger(cents) || !Number.isSafeInteger(cents * item.quantity) ||
          !Number.isSafeInteger(totalCents + cents * item.quantity)) {
        return res.status(400).json({ message: 'Montant de commande invalide.' });
      }
      totalCents += cents * item.quantity;
      orderDetails.push({ productId: product._id, quantity: item.quantity, price: cents / 100 });
    }
    const newOrder = new Order({ userId: req.user.userId, items: orderDetails,
      total: totalCents / 100, shippingAddress: address, paymentMethod, shippingMethod,
      idempotencyKey: key, requestHash, lifecycle: 'creating' });
    try {
      pendingOrder = await newOrder.save();
    } catch (error) {
      if (error.code !== 11000) throw error;
      const winner = await Order.findOne({ userId: req.user.userId, idempotencyKey: key });
      if (!winner) throw error;
      return replay(winner);
    }
    await lifecycle.reserve(pendingOrder);
    const savedOrder = await Order.findOneAndUpdate({ _id: pendingOrder._id, lifecycle: 'creating' },
      { $set: { lifecycle: 'active' } }, { new: true });
    if (!savedOrder) throw new Error('Activation impossible');
    pendingOrder = null;
    try {
      await notify({ subject: 'Nouvelle Commande Créée',
        text: `Une commande a été créée avec succès pour les produits suivants : \n${orderDetails
          .map(item => `Produit ID : ${item.productId}, Quantité : ${item.quantity}`).join('\n')}` });
    } catch {
      (req.log || logger).error('Échec de la notification de commande');
    }
    audit(req, 'order_create', 'success', { targetId: String(savedOrder._id) });
    return res.status(201).json({ message: 'Commande créée avec succès', order: lifecycle.publicOrder(savedOrder) });
  } catch (error) {
    if (pendingOrder) {
      try {
        const rollback = await Order.findOneAndUpdate({ _id: pendingOrder._id, lifecycle: 'creating' },
          { $set: { lifecycle: 'releasing', releaseTarget: 'failed', failureMessage: error.status === 409 ? error.message : 'Création de commande échouée.' } }, { new: true });
        if (rollback) await lifecycle.release(rollback);
      } catch {
        return res.status(503).json({ message: 'Commande en cours de récupération ; conservez la même clé de tentative.' });
      }
    }
    if (error.status === 409) return res.status(409).json({ message: error.message });
    return res.status(500).json({ message: 'Une erreur est survenue lors de la création de la commande.' });
  }
};

/**
 * Supprime une commande (administrateur) et restitue son stock. Refusé si expédiée ou livrée.
 * @param {express.Request} req - `params.id` : identifiant de la commande.
 * @param {express.Response} res - 204, 404 ou 409.
 * @returns {Promise<void>}
 */
exports.deleteOrder = async (req, res) => {
  const { id } = req.params;
  if (!validId(id)) return res.status(400).json({ message: 'Identifiant invalide.' });
  try {
    const order = await Order.findOne({ _id: id, ...lifecycle.visible });
    if (!order) {
      const interrupted = await Order.findOne({ _id: id, lifecycle: 'releasing', releaseTarget: 'deleted' });
      if (interrupted) { await lifecycle.release(interrupted); return res.status(204).end(); }
      const deleted = await Order.findOne({ _id: id, lifecycle: 'deleted' });
      return res.status(deleted ? 204 : 404).end();
    }
    if (['Expédiée', 'Délivrée'].includes(order.status)) {
      return res.status(409).json({ message: 'Une commande expédiée ne peut pas être supprimée.' });
    }
    const claimed = await Order.findOneAndUpdate({ _id: id, status: order.status, ...lifecycle.visible },
      { $set: { lifecycle: 'releasing', releaseTarget: 'deleted' } }, { new: true });
    if (!claimed) return res.status(409).json({ message: 'Commande en cours de modification.' });
    await lifecycle.release(claimed);
    audit(req, 'order_delete', 'success', { targetId: id });
    return res.status(204).end();
  } catch {
    return res.status(503).json({ message: 'Suppression interrompue ; une récupération est nécessaire.' });
  }
};

/**
 * Liste les commandes visibles (administrateur).
 * @param {express.Request} req
 * @param {express.Response} res - 200 tableau de commandes sans champs internes.
 * @returns {Promise<void>}
 */
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find(lifecycle.visible);
    return res.status(200).json(orders.map(lifecycle.publicOrder));
  } catch {
    return res.status(500).json({ message: 'Erreur lors de la récupération des commandes.' });
  }
};

/**
 * Applique une transition de statut autorisée ; l'annulation restitue le stock.
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {string} orderId - Identifiant de la commande.
 * @param {string} status - Nouveau statut (voir `orderLifecycle.transitions`).
 * @returns {Promise<void>}
 */
async function changeStatus(req, res, orderId, status) {
  if (!validId(orderId) || !Order.schema.path('status').enumValues.includes(status)) {
    return res.status(400).json({ message: 'Identifiant ou statut invalide.' });
  }
  try {
    const current = await Order.findOne({ _id: orderId, ...lifecycle.visible });
    if (!current) {
      if (status === 'Annulée') {
        const interrupted = await Order.findOne({ _id: orderId, lifecycle: 'releasing', releaseTarget: 'active', status: 'Annulée' });
        if (interrupted) {
          const restored = await lifecycle.release(interrupted);
          const result = restored || await Order.findOne({ _id: orderId, ...lifecycle.visible });
          if (result) return res.json({ message: 'Annulation terminée', order: lifecycle.publicOrder(result) });
        }
      }
      return res.status(404).json({ message: 'Commande non trouvée.' });
    }
    if (current.status === status) return res.json({ message: 'Statut inchangé', order: lifecycle.publicOrder(current) });
    if (!lifecycle.transitions[current.status]?.includes(status)) {
      return res.status(409).json({ message: 'Transition de statut interdite.' });
    }
    const cancelling = status === 'Annulée';
    let order = await Order.findOneAndUpdate({ _id: orderId, status: current.status, ...lifecycle.visible },
      { $set: { status, ...(cancelling ? { lifecycle: 'releasing', releaseTarget: 'active' } : {}) } },
      { new: true, runValidators: true });
    if (!order) return res.status(409).json({ message: 'Commande en cours de modification.' });
    if (cancelling) order = await lifecycle.release(order);
    else if (['Expédiée', 'Délivrée'].includes(status)) await lifecycle.discardMarkers(order);
    audit(req, 'order_status', 'success', { targetId: orderId, status });
    return res.json({ message: 'Statut mis à jour avec succès', order: lifecycle.publicOrder(order) });
  } catch {
    return res.status(503).json({ message: 'Mise à jour interrompue ; une récupération peut être nécessaire.' });
  }
}
/**
 * Passe une commande à « En cours de traitement » (administrateur).
 * @param {express.Request} req - `params.id`.
 * @param {express.Response} res
 * @returns {Promise<void>}
 */
exports.validateOrder = (req, res) => changeStatus(req, res, req.params.id, 'En cours de traitement');
/**
 * Change le statut d'une commande (administrateur).
 * @param {express.Request} req - `params.orderId`, `body.status`.
 * @param {express.Response} res
 * @returns {Promise<void>}
 */
exports.updateOrderStatus = (req, res) => changeStatus(req, res, req.params.orderId, req.body?.status);
