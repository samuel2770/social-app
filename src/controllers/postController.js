const Post = require('../models/Post');
const Like = require('../models/Like');
const Follow = require('../models/Follow');
const User = require('../models/User');
const { POST_STATES } = require('../models/Post');

// ─── Helpers ────────────────────────────────────────────────

/**
 * Parses pagination params from the query string.
 * Returns { page, limit, skip }.
 */
const parsePagination = (query, defaultLimit = 20) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || defaultLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Builds a Mongoose sort object from the query `sort` param.
 * Accepted values: like_count, comment_count, timestamp (default).
 */
const buildSort = (sortParam) => {
  const map = {
    like_count: { like_count: -1 },
    comment_count: { comment_count: -1 },
    timestamp: { createdAt: -1 },
  };
  return map[sortParam] || { createdAt: -1 };
};

// ─── POST /api/posts ─────────────────────────────────────────
const createPost = async (req, res) => {
  try {
    const { title, content, tags } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required.' });
    }

    const post = await Post.create({
      title,
      content,
      tags: tags || [],
      author: req.user._id,
      state: POST_STATES.DRAFT, // Always starts as draft
    });

    await post.populate('author', 'first_name last_name username avatar_url');
    res.status(201).json({ success: true, post });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join('. ') });
    }
    res.status(500).json({ success: false, message: 'Could not create post.' });
  }
};

// ─── GET /api/posts (public) ─────────────────────────────────
// Supports: search (author/title/tags), sort, filter by tag, pagination
const getPublishedPosts = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, 20);
    const { search, tag, sort } = req.query;

    const filter = { state: POST_STATES.PUBLISHED };

    // Text search across title and tags
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      // Search by title, tags, or author username
      const matchedAuthors = await User.find({
        $or: [
          { username: searchRegex },
          { first_name: searchRegex },
          { last_name: searchRegex },
        ],
      }).select('_id');

      filter.$or = [
        { title: searchRegex },
        { tags: searchRegex },
        { author: { $in: matchedAuthors.map((u) => u._id) } },
      ];
    }

    // Filter by a single tag
    if (tag) {
      filter.tags = tag.toLowerCase().trim();
    }

    const sortObj = buildSort(sort);

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate('author', 'first_name last_name username avatar_url'),
      Post.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_prev: page > 1,
      },
      posts,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch posts.' });
  }
};

// ─── GET /api/posts/:id (public) ────────────────────────────
const getSinglePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate(
      'author',
      'first_name last_name username bio avatar_url createdAt'
    );

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }

    // Non-owners can only see published posts
    const isOwner = req.user && post.author._id.toString() === req.user._id.toString();
    if (post.state !== POST_STATES.PUBLISHED && !isOwner) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }

    // Check if requesting user has liked the post
    let liked_by_me = false;
    if (req.user) {
      liked_by_me = !!(await Like.findOne({ user: req.user._id, post: post._id }));
    }

    res.status(200).json({ success: true, post, liked_by_me });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid post ID.' });
    }
    res.status(500).json({ success: false, message: 'Could not fetch post.' });
  }
};

// ─── PATCH /api/posts/:id ────────────────────────────────────
const updatePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only edit your own posts.' });
    }

    const { title, content, tags } = req.body;
    if (title !== undefined) post.title = title;
    if (content !== undefined) post.content = content;
    if (tags !== undefined) post.tags = tags;

    await post.save();
    await post.populate('author', 'first_name last_name username avatar_url');

    res.status(200).json({ success: true, post });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid post ID.' });
    }
    res.status(500).json({ success: false, message: 'Could not update post.' });
  }
};

// ─── PATCH /api/posts/:id/publish ───────────────────────────
const publishPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the owner can publish a post.' });
    }

    post.state = POST_STATES.PUBLISHED;
    await post.save();
    await post.populate('author', 'first_name last_name username avatar_url');

    res.status(200).json({ success: true, message: 'Post published successfully.', post });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid post ID.' });
    }
    res.status(500).json({ success: false, message: 'Could not publish post.' });
  }
};

// ─── DELETE /api/posts/:id ───────────────────────────────────
const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only delete your own posts.' });
    }

    await Promise.all([
      post.deleteOne(),
      Like.deleteMany({ post: post._id }), // Clean up likes
    ]);

    res.status(200).json({ success: true, message: 'Post deleted successfully.' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid post ID.' });
    }
    res.status(500).json({ success: false, message: 'Could not delete post.' });
  }
};

// ─── GET /api/posts/me ───────────────────────────────────────
// Owner's own posts — filterable by state, paginated
const getMyPosts = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, 20);
    const { state } = req.query;

    const filter = { author: req.user._id };

    // Validate the state filter
    if (state) {
      if (!Object.values(POST_STATES).includes(state)) {
        return res.status(400).json({
          success: false,
          message: `Invalid state. Use 'draft' or 'published'.`,
        });
      }
      filter.state = state;
    }

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'first_name last_name username avatar_url'),
      Post.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      posts,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch your posts.' });
  }
};

// ─── GET /api/posts/feed ─────────────────────────────────────
// Feed of published posts from users the logged-in user follows
const getFeed = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, 20);

    // Get the list of users this person follows
    const follows = await Follow.find({ follower: req.user._id }).select('following');
    const followingIds = follows.map((f) => f.following);

    // Include own posts in the feed too
    followingIds.push(req.user._id);

    const filter = {
      author: { $in: followingIds },
      state: POST_STATES.PUBLISHED,
    };

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'first_name last_name username avatar_url'),
      Post.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      posts,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch feed.' });
  }
};

// ─── POST /api/posts/:id/like ────────────────────────────────
const likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || post.state !== POST_STATES.PUBLISHED) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }

    // Check for duplicate like
    const existing = await Like.findOne({ user: req.user._id, post: post._id });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You have already liked this post.' });
    }

    await Like.create({ user: req.user._id, post: post._id });
    post.like_count += 1;
    await post.save();

    res.status(200).json({ success: true, message: 'Post liked.', like_count: post.like_count });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid post ID.' });
    }
    res.status(500).json({ success: false, message: 'Could not like post.' });
  }
};

// ─── DELETE /api/posts/:id/like ──────────────────────────────
const unlikePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    const like = await Like.findOneAndDelete({ user: req.user._id, post: post._id });
    if (!like) {
      return res.status(404).json({ success: false, message: 'You have not liked this post.' });
    }

    post.like_count = Math.max(0, post.like_count - 1);
    await post.save();

    res.status(200).json({ success: true, message: 'Post unliked.', like_count: post.like_count });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid post ID.' });
    }
    res.status(500).json({ success: false, message: 'Could not unlike post.' });
  }
};

module.exports = {
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
};
