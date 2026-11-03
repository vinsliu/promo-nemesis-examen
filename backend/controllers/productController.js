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
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Produit non trouvé.' });
    product.stock = numericStock;
    await product.save();
    return res.json({ message: 'Stock mis à jour avec succès.', product });
  } catch {
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
};
