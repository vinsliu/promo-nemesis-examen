// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');
const { logger, requestLogging, errorHandler } = require('./logger');

function createApp({ log = logger } = {}) {
const app = express();
app.use(requestLogging(log));
app.use(cors());
app.use(express.json());
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use(errorHandler);
return app;
}

const PORT = process.env.PORT || 5000;
async function start() {
  if (!process.env.JWT_SECRET || !process.env.MONGO_URI) throw new Error('Configuration serveur incomplète');
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
