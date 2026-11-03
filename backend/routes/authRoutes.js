// backend/routes/authRoutes.js
const express = require('express');
const { login, register } = require('../controllers/authController');

const { createAuthRateLimit } = require('../middlewares/authRateLimit');

const router = express.Router();

router.post('/login', createAuthRateLimit({ limit: 20 }), login);
router.post('/register', createAuthRateLimit({ limit: 10 }), register);

module.exports = router;
