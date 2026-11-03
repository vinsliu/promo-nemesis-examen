const express = require('express');
const { logger, requestLogging, errorHandler } = require('./logger');
function createApp({ log = logger } = {}) {
const app = express();
app.use(requestLogging(log));
app.use(express.json());

app.post('/update-stock', (req, res) => {
    const { productId, quantity } = req.body;
    req.log.info('Demande reçue par le service de stock');
    res.send(`Stock mis à jour pour le produit de ID : ${productId}`);
});
app.use(errorHandler);
return app;
}
const PORT = process.env.PORT || 4003;
if (require.main === module) createApp().listen(PORT, () => logger.info({ port: PORT }, 'Service de stock démarré'));
module.exports = { createApp };
