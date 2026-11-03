const notify = require('../services/notifications');
const Order = require('../models/Order');
const Product = require('../models/Product');
const validId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);

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

  try {
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
      total: totalCents / 100, shippingAddress: address, paymentMethod, shippingMethod });
    const savedOrder = await newOrder.save();
    try {
      await notify({ subject: 'Nouvelle Commande Créée',
        text: `Une commande a été créée avec succès pour les produits suivants : \n${orderDetails
          .map(item => `Produit ID : ${item.productId}, Quantité : ${item.quantity}`).join('\n')}` });
    } catch {
      console.error('Échec de la notification de commande');
    }
    return res.status(201).json({ message: 'Commande créée avec succès', order: savedOrder });
  } catch {
    return res.status(500).json({ message: 'Une erreur est survenue lors de la création de la commande.' });
  }
};

// Suppression métier à implémenter dans le lot fonctionnel ; accès réservé aux administrateurs.
exports.deleteOrder = async (req, res) => {};

exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find();
    return res.status(200).json(orders);
  } catch {
    return res.status(500).json({ message: 'Erreur lors de la récupération des commandes.' });
  }
};

exports.validateOrder = async (req, res) => {
  const { orderId } = req.body;
  res.status(200).json({ message: `Commande ${orderId} validée avec succès.` });
};

exports.updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body || {};
  if (!validId(orderId) || !Order.schema.path('status').enumValues.includes(status)) {
    return res.status(400).json({ message: 'Identifiant ou statut invalide.' });
  }
  try {
    const order = await Order.findByIdAndUpdate(orderId,
      { status, updatedAt: new Date() }, { new: true, runValidators: true });
    if (!order) return res.status(404).json({ message: 'Commande non trouvée.' });
    return res.status(200).json({ message: 'Statut mis à jour avec succès', order });
  } catch {
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
};
