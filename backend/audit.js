/**
 * @module audit
 */
// Journal d'audit : actions sensibles (authentification, commandes, stock).
// Ne jamais y mettre de mot de passe, de jeton, d'e-mail ni de nom saisi à la connexion.
const { logger } = require('./logger');

const auditLog = logger.child({ type: 'audit' });

/**
 * Écrit un événement d'audit (type `audit`) dans le journal Pino.
 * @param {express.Request} [req] - Fournit `req.id` et l'utilisateur (`req.user.userId`).
 * @param {string} action - Ex. `login`, `order_status`, `stock_update`.
 * @param {string} outcome - Ex. `success`, `failure`.
 * @param {object} [fields] - Champs additionnels non sensibles (`targetId`, `status`…).
 * @returns {void}
 */
module.exports = function audit(req, action, outcome, fields = {}) {
  auditLog.info({ action, outcome, requestId: req?.id, actorId: req?.user?.userId, ...fields }, 'audit');
};
