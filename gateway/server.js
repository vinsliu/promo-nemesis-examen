// gateway/server.js
const express = require('express');
const dotenv = require('dotenv');
//const authProxy = require('./routes/auth');
const notifiProxy = require('./routes/notifi');
// const stockProxy = require('./routes/stock');

dotenv.config();
const { logger, requestLogging, errorHandler } = require('./logger');

function createApp({ log = logger } = {}) {
const app = express();
app.use(requestLogging(log));

// Middleware pour analyser les requêtes JSON
app.use(express.json());

// Routes principales pour chaque microservice
//app.use('/auth', authProxy);
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/notify', notifiProxy);
// app.use('/update-stock', stockProxy);
app.use(errorHandler);
return app;
}

// Lancer le Gateway
const PORT = process.env.PORT || process.env.GATEWAY_PORT || 8000;
if (require.main === module) createApp().listen(PORT, () => {
  logger.info({ port: PORT }, 'Gateway démarrée');
});
module.exports = { createApp };
