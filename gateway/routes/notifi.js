// gateway/routes/notifi.js
const express = require('express');
const proxy = require('express-http-proxy');
const { timingSafeEqual } = require('node:crypto');
require('dotenv').config();

const router = express.Router();

const NOTIFI_SERVICE_URL = process.env.NOTIFI_SERVICE_URL;

router.use((req, res, next) => {
  if (!process.env.INTERNAL_API_TOKEN) {
    return res.status(503).json({ message: 'Configuration notifications incomplète' });
  }
  const actual = Buffer.from(req.get('Authorization') || '');
  const required = Buffer.from(`Bearer ${process.env.INTERNAL_API_TOKEN}`);
  if (actual.length !== required.length || !timingSafeEqual(actual, required)) {
    return res.status(401).json({ message: 'Accès non autorisé' });
  }
  next();
});

router.use('/', proxy(NOTIFI_SERVICE_URL, {
  timeout: 12000,
  proxyErrorHandler: (error, res) => res.status(502).json({ message: 'Service notifications indisponible' }),
  proxyReqPathResolver: (req) => req.originalUrl,
}));

module.exports = router;
