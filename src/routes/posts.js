const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const {
  createPost,
  getPublishedPosts,
  getSinglePost,
  updatePost,
  publishPost,
  deletePost,
  getMyPosts,
  getFeed,
  likePost,
  unlikePost,
} = require('../controllers/postController');

router.get('/', optionalAuth, getPublishedPosts);
router.get('/feed', protect, getFeed);
router.get('/me', protect, getMyPosts);
router.post('/', protect, createPost);
router.get('/:id', optionalAuth, getSinglePost);
router.patch('/:id', protect, updatePost);
router.patch('/:id/publish', protect, publishPost);
router.delete('/:id', protect, deletePost);
router.post('/:id/like', protect, likePost);
router.delete('/:id/like', protect, unlikePost);

module.exports = router;