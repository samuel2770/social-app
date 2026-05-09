const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Extracts and verifies the Bearer JWT from the Authorization header.
 * Returns the decoded payload or null if missing/invalid.
 */
const decodeToken = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    return user || null;
  } catch {
    return null;
  }
};

// ─── Middleware: Authentication required ───────────────────
const protect = async (req, res, next) => {
  const user = await decodeToken(req);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please sign in.',
    });
  }
  req.user = user;
  next();
};

// ─── Middleware: Authentication optional ───────────────────
// Attaches user if token is valid; continues even if not logged in.
const optionalAuth = async (req, res, next) => {
  req.user = await decodeToken(req);
  next();
};

module.exports = { protect, optionalAuth };
