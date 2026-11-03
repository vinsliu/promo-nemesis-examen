const audit = require('../audit');
const Product = require('../models/Product');

exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find();
    return res.json(products);
  } catch {
    return res.status(500).json({ message: 'Erreur lors de la récupération des produits.' });
  }
};

exports.updateProductStock = async (req, res) => {
  const { stock } = req.body || {};
  const { productId } = req.params;
  const numericStock = typeof stock === 'string' && /^\d+$/.test(stock) ? Number(stock) : stock;
  if (typeof productId !== 'string' || !/^[a-f\d]{24}$/i.test(productId) ||
      !Number.isSafeInteger(numericStock) || numericStock < 0) {
    return res.status(400).json({ message: 'Identifiant valide et stock entier positif ou nul requis.' });
  }
  try {
    // Keep available stock + all outstanding reservations safe even after cancellation.
    const reservedTotal = { $sum: { $map: { input: { $objectToArray: { $ifNull: ['$reservations', {}] } }, as: 'entry', in: '$$entry.v' } } };
    const product = await Product.findOneAndUpdate({ _id: productId,
      $expr: { $lte: [{ $add: [numericStock, reservedTotal] }, Number.MAX_SAFE_INTEGER] } },
      { $set: { stock: numericStock } }, { new: true, runValidators: true });
    if (!product) {
      const exists = await Product.exists({ _id: productId });
      return res.status(exists ? 409 : 404).json({ message: exists ? 'Stock trop élevé compte tenu des réservations.' : 'Produit non trouvé.' });
    }
    audit(req, 'stock_update', 'success', { targetId: productId, stock: numericStock });
    return res.json({ message: 'Stock mis à jour avec succès.', product });
  } catch {
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
};
