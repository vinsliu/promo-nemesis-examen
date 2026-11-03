const Joi = require('joi');

const objectId = Joi.string().hex().length(24);
const orderStatuses = ['En attente', 'En cours de traitement', 'Expédiée', 'Délivrée', 'Annulée'];
const passwordRules = Joi.string().max(1024)
  .pattern(/[A-Z]/, 'majuscule').pattern(/[a-z]/, 'minuscule')
  .pattern(/[0-9]/, 'chiffre').pattern(/[^A-Za-z0-9\s]/, 'caractère spécial')
  .custom((value, helpers) => ([...value].length >= 12 && Buffer.byteLength(value, 'utf8') <= 72 ? value : helpers.error('any.invalid')))
  .messages({ '*': 'Le mot de passe doit contenir au moins 12 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial (72 octets maximum).' });
const text = max => Joi.string().trim().min(1).max(max).required();

exports.register = { body: Joi.object({
  username: Joi.string().trim().min(3).max(30).required(),
  email: Joi.string().trim().lowercase().max(254).email({ tlds: { allow: false } }).required(),
  password: passwordRules.required(),
}) };

exports.login = { body: Joi.object({
  username: text(100),
  password: Joi.string().min(1).max(1024).required(),
}) };

exports.createOrder = { body: Joi.object({
  items: Joi.array().min(1).max(100).items(Joi.object({
    productId: objectId.required(),
    quantity: Joi.number().integer().min(1).max(Number.MAX_SAFE_INTEGER).required(),
  })).required(),
  shippingAddress: Joi.object({
    street: text(200), city: text(100), postalCode: text(20), country: text(100),
  }).required(),
  paymentMethod: Joi.string().valid('Carte bancaire', 'PayPal', 'Virement').required(),
  shippingMethod: Joi.string().valid('colissimo', 'chronopost').required(),
}) };

exports.orderIdParam = { params: Joi.object({ id: objectId.required() }) };

exports.orderStatus = {
  params: Joi.object({ orderId: objectId.required() }),
  body: Joi.object({ status: Joi.string().valid(...orderStatuses).required() }),
};

exports.productStock = {
  params: Joi.object({ productId: objectId.required() }),
  body: Joi.object({ stock: Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER).required() }),
};
