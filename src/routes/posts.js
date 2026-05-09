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

// ─── Public + optional auth ──────────────────────────────────
// GET  /api/posts          – List all published posts (search, filter, sort, paginate)
router.get('/', optionalAuth, getPublishedPosts);

// ─── Protected routes ────────────────────────────────────────
// GET  /api/posts/feed     – Logged-in user's personalized feed
router.get('/feed', protect, getFeed);

// GET  /api/posts/me       – Logged-in user's own posts (all states)
router.get('/me', protect, getMyPosts);

// POST /api/posts          – Create a new post (starts as draft)
router.post('/', protect, createPost);

// GET  /api/posts/:id      – Get a single post
router.get('/:id', optionalAuth, getSinglePost);

// PATCH /api/posts/:id     – Edit a post (owner only)
router.patch('/:id', protect, updatePost);

// PATCH /api/posts/:id/publish – Publish a draft (owner only)
router.patch('/:id/publish', protect, publishPost);

// DELETE /api/posts/:id   – Delete a post (owner only)
router.delete('/:id', protect, deletePost);

// POST   /api/posts/:id/like   – Like a post
router.post('/:id/like', protect, likePost);

// DELETE /api/posts/:id/like  – Unlike a post
router.delete('/:id/like', protect, unlikePost);

module.exports = router;
