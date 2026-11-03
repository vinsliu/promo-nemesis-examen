// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');

const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const app = express();

// Origines autorisées (CORS_ORIGIN, séparées par des virgules). Sans valeur :
// le front de développement en local, ou aucune origine croisée en production.
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean)
  : process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000'];

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use((req, res) => res.status(404).json({ message: 'Ressource introuvable.' }));
// Réponse JSON uniquement : jamais de page HTML ni de stack trace.
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Corps de requête JSON invalide.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Corps de requête trop volumineux.' });
  console.error('Erreur non gérée :', error.message);
  return res.status(500).json({ message: 'Erreur serveur.' });
});

const PORT = process.env.PORT || 5000;
async function start() {
  if (!process.env.MONGO_URI || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('Configuration serveur incomplète (JWT_SECRET : 32 caractères minimum)');
  }
  await connectDB();
  await require('./models/User').init();
  await require('./models/Order').init();
  await require('./services/orderLifecycle').recoverOrders();
  app.listen(PORT, () => console.log(`Serveur en écoute sur le port ${PORT}`));
}
start().catch(async error => {
  if (error.code === 11000 && error.message.includes('username_case_insensitive')) {
    console.error('Des noms utilisateurs historiques ne diffèrent que par la casse : résoudre ces collisions avant de démarrer. Aucun compte ne sera fusionné automatiquement.');
  }
  console.error('Démarrage du serveur impossible');
  await require('mongoose').disconnect();
  process.exitCode = 1;
});