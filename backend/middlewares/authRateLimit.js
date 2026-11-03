// Process-local protection. Use a shared store when running several backend instances.
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
