/**
 * Message Model
 * Handles chat messages and AI moderation results
 */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  originalContent: {
    type: String,
    maxlength: 2000,
    select: false // Store original if message was modified
  },
  type: {
    type: String,
    enum: ['text', 'system', 'ai-feedback', 'fact-check', 'warning'],
    default: 'text'
  },
  status: {
    type: String,
    enum: ['pending', 'pending_review', 'approved', 'blocked', 'modified', 'deleted', 'delivered', 'flagged'],
    default: 'pending'
  },
  moderation: {
    analyzed: { type: Boolean, default: false },
    analyzedAt: { type: Date },
    toxicity: {
      score: { type: Number, min: 0, max: 1 },
      categories: [{
        name: String,
        score: Number
      }],
      flagged: { type: Boolean, default: false }
    },
    fallacy: {
      detected: { type: Boolean, default: false },
      types: [{
        name: String,
        confidence: Number,
        explanation: String
      }]
    },
    factCheck: {
      performed: { type: Boolean, default: false },
      claims: [{
        claim: String,
        verdict: {
          type: String,
          enum: ['verified', 'false', 'misleading', 'unverifiable', 'partially-true']
        },
        sources: [String],
        explanation: String
      }]
    },
    aiNotes: String
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    type: {
      type: String,
      enum: ['agree', 'disagree', 'insightful', 'citation-needed']
    }
  }],
  editHistory: [{
    content: String,
    editedAt: { type: Date, default: Date.now },
    reason: String
  }],
  isEdited: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient querying
messageSchema.index({ room: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ 'moderation.toxicity.flagged': 1 });
messageSchema.index({ status: 1 });

const HIDDEN_MESSAGE_STATUSES = ['blocked', 'pending', 'pending_review'];

// Virtual for reaction count
messageSchema.virtual('reactionCounts').get(function() {
  const counts = {};
  this.reactions.forEach(r => {
    counts[r.type] = (counts[r.type] || 0) + 1;
  });
  return counts;
});

// Method to add reaction
messageSchema.methods.addReaction = function(userId, reactionType) {
  const existingReaction = this.reactions.find(
    r => r.user.toString() === userId.toString()
  );
  
  if (existingReaction) {
    existingReaction.type = reactionType;
  } else {
    this.reactions.push({ user: userId, type: reactionType });
  }
  
  return this;
};

// Method to remove reaction
messageSchema.methods.removeReaction = function(userId) {
  this.reactions = this.reactions.filter(
    r => r.user.toString() !== userId.toString()
  );
  return this;
};

// Static method to get room messages with pagination
messageSchema.statics.getRoomMessages = async function(roomId, page = 1, limit = 50) {
  const skip = (page - 1) * limit;
  const query = this.visibleQuery(roomId);
  
  const messages = await this.find(query)
    .populate('sender', 'username profile.avatar')
    .populate('replyTo', 'content sender')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  
  const total = await this.countDocuments(query);
  
  return {
    messages: messages.reverse(),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

messageSchema.statics.visibleQuery = function(roomId) {
  return {
    room: roomId,
    isDeleted: false,
    status: { $nin: HIDDEN_MESSAGE_STATUSES }
  };
};

messageSchema.statics.visibleCountQuery = function(roomId) {
  return this.visibleQuery(roomId);
};

messageSchema.statics.getVisibleRoomMessages = async function(roomId, page = 1, limit = 50) {
  return this.getRoomMessages(roomId, page, limit);
};

module.exports = mongoose.model('Message', messageSchema);
