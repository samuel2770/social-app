const mongoose = require('mongoose');

const POST_STATES = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
};

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Post title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    content: {
      type: String,
      required: [true, 'Post content is required'],
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tags: {
      type: [String],
      default: [],
      set: (tags) => tags.map((t) => t.toLowerCase().trim()),
    },
    state: {
      type: String,
      enum: Object.values(POST_STATES),
      default: POST_STATES.DRAFT, // Posts start as drafts
    },
    like_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    comment_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    read_time: {
      type: Number, // Estimated read time in minutes
      default: 1,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes for fast searching & sorting ──────────────────
postSchema.index({ title: 'text', tags: 'text' });
postSchema.index({ author: 1, state: 1 });
postSchema.index({ state: 1, createdAt: -1 });
postSchema.index({ like_count: -1 });

// ─── Pre-save: Calculate read time ─────────────────────────
postSchema.pre('save', function (next) {
  const wordsPerMinute = 200;
  const wordCount = this.content.split(/\s+/).length;
  this.read_time = Math.max(1, Math.ceil(wordCount / wordsPerMinute));
  next();
});

module.exports = mongoose.model('Post', postSchema);
module.exports.POST_STATES = POST_STATES;
