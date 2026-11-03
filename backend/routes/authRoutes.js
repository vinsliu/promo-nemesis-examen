// backend/routes/authRoutes.js
const express = require('express');
const { login, register, logout, me } = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { createAuthRateLimit } = require('../middlewares/authRateLimit');
const validate = require('../middlewares/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.post('/login', createAuthRateLimit({ limit: 20 }), validate(schemas.login), login);
router.post('/register', createAuthRateLimit({ limit: 10 }), validate(schemas.register), register);
router.post('/logout', logout);
router.get('/me', authenticateToken, me);

module.exports = router;
