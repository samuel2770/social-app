const mongoose = require('mongoose');

const POST_STATES = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
};

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    state: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    like_count: {
      type: Number,
      default: 0,
    },
    comment_count: {
      type: Number,
      default: 0,
    },
    read_time: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

postSchema.pre('save', function (next) {
  const wordCount = this.content.split(/\s+/).length;
  this.read_time = Math.max(1, Math.ceil(wordCount / 200));
  next();
});

module.exports = mongoose.model('Post', postSchema);
module.exports.POST_STATES = POST_STATES;