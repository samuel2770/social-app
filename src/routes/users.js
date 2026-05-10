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

router.get('/me/following', protect, getFollowing);
router.get('/me/followers', protect, getFollowers);
router.get('/:username', optionalAuth, getUserProfile);
router.post('/:id/follow', protect, followUser);
router.delete('/:id/follow', protect, unfollowUser);

module.exports = router;