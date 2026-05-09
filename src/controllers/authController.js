const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Generates a signed JWT for the given user ID.
 */
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });

/**
 * Builds and sends the auth response with token + user data.
 */
const sendAuthResponse = (user, statusCode, res) => {
  const token = signToken(user._id);

  // Strip sensitive fields
  const userData = {
    _id: user._id,
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.username,
    email: user.email,
    bio: user.bio,
    avatar_url: user.avatar_url,
    createdAt: user.createdAt,
  };

  res.status(statusCode).json({
    success: true,
    token,
    expires_in: '1h',
    user: userData,
  });
};

// ─── POST /api/auth/signup ──────────────────────────────────
const signup = async (req, res) => {
  try {
    const { first_name, last_name, username, email, password, bio } = req.body;

    // Basic field validation
    if (!first_name || !last_name || !username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'first_name, last_name, username, email and password are required.',
      });
    }

    // Check for existing user
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      const field = existing.email === email.toLowerCase() ? 'email' : 'username';
      return res.status(409).json({
        success: false,
        message: `A user with this ${field} already exists.`,
      });
    }

    const user = await User.create({ first_name, last_name, username, email, password, bio });
    sendAuthResponse(user, 201, res);
  } catch (err) {
    // Mongoose validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join('. ') });
    }
    res.status(500).json({ success: false, message: 'Server error during signup.' });
  }
};

// ─── POST /api/auth/signin ──────────────────────────────────
const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    // Explicitly select password (it's excluded by default)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    sendAuthResponse(user, 200, res);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error during signin.' });
  }
};

// ─── GET /api/auth/me ───────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('follower_count')
      .populate('following_count');

    res.status(200).json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch profile.' });
  }
};

module.exports = { signup, signin, getMe };
