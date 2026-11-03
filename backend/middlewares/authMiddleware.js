/**
 * @module middlewares/authMiddleware
 */
const jwt = require('jsonwebtoken');

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Vérifie le JWT (cookie HttpOnly, sinon en-tête Bearer) et renseigne `req.user`.
 * Pour un cookie, exige `X-Requested-With: XMLHttpRequest` sur les méthodes modifiantes (CSRF).
 * @type {express.RequestHandler}
 */
exports.authenticateToken = (req, res, next) => {
  const authorization = req.headers.authorization;
  const cookieToken = req.cookies?.token;
  let rawToken;
  if (typeof cookieToken === 'string' && cookieToken) {
    // Cookie HttpOnly : exiger un en-tête personnalisé sur les requêtes modifiantes (CSRF).
    if (!SAFE_METHODS.includes(req.method) && req.get?.('X-Requested-With') !== 'XMLHttpRequest') {
      return res.status(403).json({ message: 'Requête non autorisée.' });
    }
    rawToken = cookieToken;
  } else if (typeof authorization === 'string' && /^Bearer [^\s]+$/i.test(authorization)) {
    rawToken = authorization.slice(7);
  } else {
    return res.status(401).json({ message: 'Authentification requise.' });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(503).json({ message: 'Authentification indisponible.' });
  }
  try {
    const user = jwt.verify(rawToken, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!user || typeof user !== 'object' ||
        typeof user.userId !== 'string' || !/^[a-f\d]{24}$/i.test(user.userId) ||
        !['user', 'admin'].includes(user.role)) {
      return res.status(401).json({ message: 'Token invalide ou expiré.' });
    }
    req.user = user;
  } catch {
    return res.status(401).json({ message: 'Token invalide ou expiré.' });
  }
  return next();
};

/**
 * Autorise uniquement le rôle `admin` ; à placer après `authenticateToken`.
 * @type {express.RequestHandler}
 */
exports.isAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Accès interdit' });
  return next();
};
