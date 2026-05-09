const User = require('../models/User');
const Follow = require('../models/Follow');

// ─── GET /api/users/:username ────────────────────────────────
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username.toLowerCase() })
      .populate('follower_count')
      .populate('following_count');

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Check if the requesting user follows this profile
    let is_following = false;
    if (req.user) {
      is_following = !!(await Follow.findOne({ follower: req.user._id, following: user._id }));
    }

    res.status(200).json({ success: true, user, is_following });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch user profile.' });
  }
};

// ─── POST /api/users/:id/follow ──────────────────────────────
const followUser = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found.' });

    // Cannot follow yourself
    if (req.user._id.toString() === targetUser._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot follow yourself.' });
    }

    // Check for existing follow
    const existing = await Follow.findOne({
      follower: req.user._id,
      following: targetUser._id,
    });

    if (existing) {
      return res.status(409).json({ success: false, message: 'You are already following this user.' });
    }

    await Follow.create({ follower: req.user._id, following: targetUser._id });

    res.status(200).json({ success: true, message: `You are now following @${targetUser.username}.` });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }
    res.status(500).json({ success: false, message: 'Could not follow user.' });
  }
};

// ─── DELETE /api/users/:id/follow ───────────────────────────
const unfollowUser = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found.' });

    const follow = await Follow.findOneAndDelete({
      follower: req.user._id,
      following: targetUser._id,
    });

    if (!follow) {
      return res.status(404).json({ success: false, message: 'You are not following this user.' });
    }

    res.status(200).json({ success: true, message: `You have unfollowed @${targetUser.username}.` });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }
    res.status(500).json({ success: false, message: 'Could not unfollow user.' });
  }
};

// ─── GET /api/users/me/following ─────────────────────────────
const getFollowing = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [follows, total] = await Promise.all([
      Follow.find({ follower: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('following', 'first_name last_name username bio avatar_url'),
      Follow.countDocuments({ follower: req.user._id }),
    ]);

    const users = follows.map((f) => f.following);

    res.status(200).json({
      success: true,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      users,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch following list.' });
  }
};

// ─── GET /api/users/me/followers ─────────────────────────────
const getFollowers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [follows, total] = await Promise.all([
      Follow.find({ following: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('follower', 'first_name last_name username bio avatar_url'),
      Follow.countDocuments({ following: req.user._id }),
    ]);

    const users = follows.map((f) => f.follower);

    res.status(200).json({
      success: true,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      users,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch followers list.' });
  }
};

module.exports = { getUserProfile, followUser, unfollowUser, getFollowing, getFollowers };
