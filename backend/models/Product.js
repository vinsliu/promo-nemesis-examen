// backend/models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  reservations: { type: Map, of: Number, select: false },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String, required: true },
  stock: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
}, {
  timestamps: true, // Ajoute createdAt et updatedAt
});

module.exports = mongoose.model('Product', productSchema);