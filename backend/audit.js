// Journal d'audit : actions sensibles (authentification, commandes, stock).
// Ne jamais y mettre de mot de passe, de jeton, d'e-mail ni de nom saisi à la connexion.
const { logger } = require('./logger');

const auditLog = logger.child({ type: 'audit' });

module.exports = function audit(req, action, outcome, fields = {}) {
  auditLog.info({ action, outcome, requestId: req?.id, actorId: req?.user?.userId, ...fields }, 'audit');
};
