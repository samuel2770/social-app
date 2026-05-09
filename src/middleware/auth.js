const express = require('express');
const router = express.Router();
const { signup, signin, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// POST /api/auth/signup  – Register a new user
router.post('/signup', signup);

// POST /api/auth/signin  – Login and receive JWT
router.post('/signin', signin);

// GET  /api/auth/me      – Get current user profile (protected)
router.get('/me', protect, getMe);

module.exports = router;
