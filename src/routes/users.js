const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const {
  getUserProfile,
  followUser,
  unfollowUser,
  getFollowing,
  getFollowers,
} = require('../controllers/userController');

// GET  /api/users/:username        – Public user profile
router.get('/:username', optionalAuth, getUserProfile);

// POST   /api/users/:id/follow     – Follow a user
router.post('/:id/follow', protect, followUser);

// DELETE /api/users/:id/follow     – Unfollow a user
router.delete('/:id/follow', protect, unfollowUser);

// GET  /api/users/me/following     – List users I follow
router.get('/me/following', protect, getFollowing);

// GET  /api/users/me/followers     – List users following me
router.get('/me/followers', protect, getFollowers);

module.exports = router;
