const jwt = require('jsonwebtoken');

exports.authenticateToken = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string' || !/^Bearer [^\s]+$/i.test(authorization)) {
    return res.status(401).json({ message: 'Authentification requise.' });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(503).json({ message: 'Authentification indisponible.' });
  }
  try {
    const user = jwt.verify(authorization.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] });
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

exports.isAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Accès interdit' });
  return next();
};
