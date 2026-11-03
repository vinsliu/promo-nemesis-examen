/**
 * @module middlewares/authRateLimit
 */
// Process-local protection. Use a shared store when running several backend instances.
/**
 * Crée un limiteur de tentatives en mémoire, par adresse du socket.
 * @param {object} options
 * @param {number} options.limit - Requêtes autorisées par fenêtre.
 * @param {number} [options.windowMs=900000] - Durée de la fenêtre.
 * @param {number} [options.maxEntries=10000] - Nombre maximal d'adresses suivies.
 * @param {function(): number} [options.now] - Horloge injectable pour les tests.
 * @returns {express.RequestHandler} Répond 429 avec `Retry-After` au-delà de la limite.
 */
function createAuthRateLimit({ limit, windowMs = 15 * 60 * 1000, maxEntries = 10000, now = Date.now }) {
  const attempts = new Map();
  return (req, res, next) => {
    const currentTime = now();
    for (const [key, value] of attempts) {
      if (value.resetAt <= currentTime) attempts.delete(key);
    }
    // Use the socket peer, never an untrusted client-supplied forwarding header.
    const key = req.socket.remoteAddress || 'unknown';
    let entry = attempts.get(key);
    if (!entry && attempts.size < maxEntries) {
      entry = { count: 0, resetAt: currentTime + windowMs };
      attempts.set(key, entry);
    }
    if (!entry || entry.count >= limit) {
      const retrySeconds = Math.max(1, Math.ceil(((entry?.resetAt || currentTime + windowMs) - currentTime) / 1000));
      res.set('Retry-After', String(retrySeconds));
      return res.status(429).json({ message: 'Trop de tentatives. Veuillez réessayer plus tard.' });
    }
    entry.count += 1;
    return next();
  };
}

module.exports = { createAuthRateLimit };
