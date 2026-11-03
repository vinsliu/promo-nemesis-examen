const axios = require('axios');

module.exports = function notify({ to = process.env.NOTIFICATION_EMAIL, subject, text }) {
  if (!process.env.INTERNAL_API_TOKEN || !to) {
    throw new Error('Configuration notifications incomplète');
  }
  return axios.post(process.env.NOTIFICATION_URL || 'http://localhost:8000/notify',
    { to, subject, text },
    { headers: { Authorization: `Bearer ${process.env.INTERNAL_API_TOKEN}` }, timeout: 15000 });
};
