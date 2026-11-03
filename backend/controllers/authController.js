const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const usernameCollation = { locale: 'fr', strength: 2 };
require('dotenv').config();

const invalidCredentials = { message: 'Identifiants incorrects.' };
const duplicateAccount = { message: "Cet email ou ce nom d'utilisateur est déjà utilisé." };
// Compare even for an unknown account to avoid a cheap account-existence timing signal.
const dummyPasswordHash = bcrypt.hashSync('unused-authentication-password', 10);
const validText = (value, max) => typeof value === 'string' &&
  value.trim().length > 0 && value.length <= max;

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
    if (!user || !isMatch) return res.status(401).json(invalidCredentials);
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' });
    return res.json({ token, role: user.role, username: user.username });
  } catch {
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

exports.register = async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!validText(username, 100) || !validText(email, 254) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== 'string' || !password.trim() ||
      Buffer.byteLength(password, 'utf8') < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ message: 'Nom, email et mot de passe valides requis (mot de passe : 8 à 72 octets).' });
  }

  try {
    const normalizedEmail = email.trim();
    const normalizedUsername = username.trim();
    const existingUser = await User.findOne({ $or: [{ email: normalizedEmail }, { username: normalizedUsername }] }).collation(usernameCollation);
    if (existingUser) return res.status(409).json(duplicateAccount);
    // Never accept a client-supplied role.
    const user = new User({ username: normalizedUsername, email: normalizedEmail, password });
    await user.save();
    return res.status(201).json({ message: 'Utilisateur créé avec succès.' });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json(duplicateAccount);
    return res.status(500).json({ message: 'Une erreur est survenue.' });
  }
};
