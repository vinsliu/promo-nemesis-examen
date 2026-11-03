/**
 * @module services/notifications
 */
const axios = require('axios');

/**
 * Envoie une notification par e-mail via la gateway, authentifiée par `INTERNAL_API_TOKEN`.
 * @param {object} message
 * @param {string} [message.to] - Destinataire (par défaut `NOTIFICATION_EMAIL`).
 * @param {string} message.subject
 * @param {string} message.text
 * @returns {Promise<axios.AxiosResponse>}
 * @throws {Error} Si la configuration est incomplète.
 */
module.exports = function notify({ to = process.env.NOTIFICATION_EMAIL, subject, text }) {
  if (!process.env.INTERNAL_API_TOKEN || !to) {
    throw new Error('Configuration notifications incomplète');
  }
  return axios.post(process.env.NOTIFICATION_URL || 'http://localhost:8000/notify',
    { to, subject, text },
    { headers: { Authorization: `Bearer ${process.env.INTERNAL_API_TOKEN}` }, timeout: 15000 });
};
