/**
 * @module controllers/authController
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const audit = require('../audit');
const usernameCollation = { locale: 'fr', strength: 2 };
require('dotenv').config();

// Cookie HttpOnly : inaccessible au JavaScript, donc non volable par XSS.
// COOKIE_SAMESITE=none (front et API sur des sites différents) impose Secure.
const sameSite = ['strict', 'lax', 'none'].includes(process.env.COOKIE_SAMESITE) ? process.env.COOKIE_SAMESITE : 'strict';
const cookieOptions = { httpOnly: true, sameSite, secure: sameSite === 'none' || process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 1000, path: '/' };
const invalidCredentials = { message: 'Identifiants incorrects.' };
const duplicateAccount = { message: "Cet email ou ce nom d'utilisateur est déjà utilisé." };
// Compare even for an unknown account to avoid a cheap account-existence timing signal.
const dummyPasswordHash = bcrypt.hashSync('unused-authentication-password', 10);
const validText = (value, max) => typeof value === 'string' &&
  value.trim().length > 0 && value.length <= max;

/**
 * Authentifie un utilisateur et pose le jeton JWT dans un cookie HttpOnly.
 * Répond 401 avec le même message pour un compte inconnu ou un mauvais mot de passe.
 * @param {express.Request} req - `body` : `{ username, password }`.
 * @param {express.Response} res - 200 `{ role, username, userId, expiresAt }`.
 * @returns {Promise<void>}
 */
exports.login = async (req, res) => {
  const { username, password } = req.body || {};
  if (!validText(username, 100) || !validText(password, 1024) ||
      Buffer.byteLength(password, 'utf8') > 1024) {
    return res.status(400).json({ message: 'Identifiants invalides.' });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(503).json({ message: 'Authentification indisponible.' });
  }

  try {
    const user = await User.findOne({ username }).collation(usernameCollation);
    const isMatch = await bcrypt.compare(password, user ? user.password : dummyPasswordHash);
    if (!user || !isMatch) {
      audit(req, 'login', 'failure');
      return res.status(401).json(invalidCredentials);
    }
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' });
    res.cookie('token', token, cookieOptions);
    audit(req, 'login', 'success', { actorId: String(user._id) });
    return res.json({ role: user.role, username: user.username, userId: String(user._id),
      expiresAt: Date.now() + cookieOptions.maxAge });
  } catch {
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

/**
 * Crée un compte avec le rôle `user` (le rôle n'est jamais lu dans la requête).
 * Le mot de passe exige 12 caractères, majuscule, minuscule, chiffre et caractère spécial.
 * @param {express.Request} req - `body` : `{ username, email, password }`.
 * @param {express.Response} res - 201 si créé, 409 si doublon, 400 si invalide.
 * @returns {Promise<void>}
 */
exports.register = async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!validText(username, 100) || !validText(email, 254) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== 'string' || [...password].length < 12 ||
      !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9\s]/.test(password) || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ message: 'Nom et email valides requis. Le mot de passe doit contenir au moins 12 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial (72 octets maximum).' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();
    const existingUser = await User.findOne({ $or: [{ email: normalizedEmail }, { username: normalizedUsername }] }).collation(usernameCollation);
    if (existingUser) {
      audit(req, 'register', 'duplicate');
      return res.status(409).json(duplicateAccount);
    }
    // Never accept a client-supplied role.
    const user = new User({ username: normalizedUsername, email: normalizedEmail, password });
    await user.save();
    audit(req, 'register', 'success', { actorId: String(user._id) });
    return res.status(201).json({ message: 'Utilisateur créé avec succès.' });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json(duplicateAccount);
    return res.status(500).json({ message: 'Une erreur est survenue.' });
  }
};

/**
 * Efface le cookie de session.
 * @param {express.Request} req
 * @param {express.Response} res - 204.
 * @returns {void}
 */
exports.logout = (req, res) => {
  const { maxAge, ...clearOptions } = cookieOptions;
  res.clearCookie('token', clearOptions);
  audit(req, 'logout', 'success');
  return res.status(204).end();
};

// L'état de la session vient de la base : un rôle retiré ou un compte supprimé prend effet immédiatement.
/**
 * Retourne l'utilisateur de la session, relu en base (rôle à jour).
 * @param {express.Request} req - Nécessite `authenticateToken`.
 * @param {express.Response} res - 200 `{ userId, username, role }` ou 401.
 * @returns {Promise<void>}
 */
exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('username role');
    if (!user) return res.status(401).json({ message: 'Session invalide.' });
    return res.json({ userId: String(user._id), username: user.username, role: user.role });
  } catch {
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};
