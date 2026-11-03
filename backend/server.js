/**
 * @module server
 */
// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');
const { logger, requestLogging, errorHandler } = require('./logger');

const helmet = require('helmet');
const cookieParser = require('cookie-parser');

/**
 * Construit l'application Express (helmet, CORS en liste blanche, cookies, routes, erreurs JSON).
 * @param {object} [options]
 * @param {object} [options.log] - Logger Pino injectable pour les tests.
 * @returns {express.Express}
 */
function createApp({ log = logger } = {}) {
  const app = express();
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim().replace(/\/+$/, '')).filter(Boolean)
    : process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000'];
  app.use(requestLogging(log));
  app.disable('x-powered-by');
  // L'API est appelée depuis un autre domaine (front) : CORP cross-origin, l'accès reste filtré par CORS.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '10kb' }));
  app.use('/api/products', require('./routes/productRoutes'));
  app.use('/api/orders', require('./routes/orderRoutes'));
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use((req, res) => res.status(404).json({ message: 'Ressource introuvable.' }));
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Corps de requête JSON invalide.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Corps de requête trop volumineux.' });
    return errorHandler(error, req, res, next);
  });
  return app;
}

const PORT = process.env.PORT || 5000;
async function start() {
  if (!process.env.MONGO_URI || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('Configuration serveur incomplète (JWT_SECRET : 32 caractères minimum)');
  }
  await connectDB();
  await require('./models/User').init();
  await require('./models/Order').init();
  await require('./services/orderLifecycle').recoverOrders();
  return createApp().listen(PORT, () => logger.info({ port: PORT }, 'Serveur démarré'));
}
if (require.main === module) start().catch(async error => {
  if (error.code === 11000 && error.message.includes('username_case_insensitive')) {
    logger.error('Des noms utilisateurs historiques ne diffèrent que par la casse : résoudre ces collisions avant de démarrer. Aucun compte ne sera fusionné automatiquement.');
  }
  logger.fatal('Démarrage du serveur impossible');
  await require('mongoose').disconnect();
  process.exitCode = 1;
});
module.exports = { createApp, start };
