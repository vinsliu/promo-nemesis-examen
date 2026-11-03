const express = require('express');
const nodemailer = require('nodemailer');
const { timingSafeEqual } = require('node:crypto');
require('dotenv').config();

function createApp({ env = process.env, fetchEmail = globalThis.fetch, createTransport = nodemailer.createTransport } = {}) {
  const app = express();
  app.use(express.json({ limit: '16kb' }));
  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.post('/notify', async (req, res) => {
    const expected = env.INTERNAL_API_TOKEN;
    if (!expected) return res.status(503).json({ message: 'Configuration notifications incomplète' });
    const actual = Buffer.from(req.get('Authorization') || '');
    const required = Buffer.from(`Bearer ${expected}`);
    if (actual.length !== required.length || !timingSafeEqual(actual, required)) {
      return res.status(401).json({ message: 'Accès non autorisé' });
    }

    const { to, subject, text } = req.body || {};
    const provider = env.EMAIL_PROVIDER || 'smtp';
    // En mode test Resend, ne jamais envoyer au destinataire fourni par l'appelant.
    const recipient = provider === 'resend' ? env.NOTIFICATION_TEST_EMAIL : to;
    if (provider !== 'smtp' && provider !== 'resend') {
      return res.status(503).json({ message: 'Fournisseur email non configuré' });
    }
    if (provider === 'resend' && (!env.RESEND_API_KEY || !recipient)) {
      return res.status(503).json({ message: 'Configuration Resend incomplète' });
    }
    if (provider === 'smtp' && (!env.EMAIL_USER || !env.EMAIL_APPLICATION_PASSWORD)) {
      return res.status(503).json({ message: 'Configuration SMTP incomplète' });
    }
    if (typeof recipient !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) ||
        typeof subject !== 'string' || !subject.trim() || subject.length > 200 ||
        typeof text !== 'string' || !text.trim() || text.length > 10000) {
      return res.status(400).json({ message: 'Destinataire, sujet et texte valides requis' });
    }

    try {
      if (provider === 'resend') {
        const response = await fetchEmail('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'Promo Némésis Examen <onboarding@resend.dev>', to: [recipient], subject, text }),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error('Provider rejected request');
      } else {
        const transporter = createTransport({
          service: 'gmail',
          auth: { user: env.EMAIL_USER, pass: env.EMAIL_APPLICATION_PASSWORD },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 10000,
        });
        await transporter.sendMail({ from: env.EMAIL_USER, to: recipient, subject, text });
      }
      return res.json({ message: 'Email accepté par le fournisseur' });
    } catch {
      // Ne pas exposer les identifiants, le contenu de l'email ou la réponse du fournisseur.
      console.error('Échec du fournisseur de notifications');
      return res.status(502).json({ message: 'Envoi de notification indisponible' });
    }
  });
  return app;
}

if (require.main === module) {
  const PORT = process.env.PORT || process.env.NOTIFI_PORT || 4002;
  createApp().listen(PORT, () => console.log(`Service notifications sur le port ${PORT}`));
}
module.exports = { createApp };
