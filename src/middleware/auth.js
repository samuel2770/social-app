const jwt = require('jsonwebtoken');
const User = require('../models/User');

const decodeToken = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    return user || null;
  } catch { return null; }
};

const protect = async (req, res, next) => {
  const user = await decodeToken(req);
  if (!user) return res.status(401).json({ success: false, message: 'Authentication required.' });
  req.user = user;
  next();
};

const optionalAuth = async (req, res, next) => {
  req.user = await decodeToken(req);
  next();
};

module.exports = { protect, optionalAuth };
