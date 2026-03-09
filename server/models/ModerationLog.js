/**
 * ModerationLog Model
 * Tracks all moderation actions and AI decisions
 */

const mongoose = require('mongoose');

const moderationLogSchema = new mongoose.Schema({
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room'
  },
  message: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  action: {
    type: String,
    enum: [
      'warning-issued',
      'message-blocked',
      'message-modified',
      'message-approved',
      'message-deleted',
      'user-muted',
      'user-unmuted',
      'user-kicked',
      'user-banned',
      'user-unbanned',
      'user-status-updated',
      'room-archived',
      'toxicity-detected',
      'fallacy-detected',
      'fact-check-failed',
      'ai-override',
      'manual-review'
    ],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  source: {
    type: String,
    enum: ['ai', 'moderator', 'admin', 'system'],
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // null if performed by AI/system
  },
  details: {
    originalContent: String,
    normalizedContent: String,
    matchedTerms: [String],
    filterEngine: String,
    blockedReason: String,
    warningCount: Number,
    violationCount: Number,
    muteExpiresAt: Date,
    modifiedContent: String,
    aiScores: {
      toxicity: Number,
      fallacyConfidence: Number
    },
    fallacyTypes: [String],
    factCheckResults: mongoose.Schema.Types.Mixed,
    reason: String,
    notes: String
  },
  acknowledged: { type: Boolean, default: false },
  acknowledgedAt: { type: Date },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  appealed: { type: Boolean, default: false },
  appealStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'none'],
    default: 'none'
  },
  appealReason: String,
  appealResponse: String
}, {
  timestamps: true
});

// Indexes for efficient querying
moderationLogSchema.index({ targetUser: 1, createdAt: -1 });
moderationLogSchema.index({ room: 1, createdAt: -1 });
moderationLogSchema.index({ action: 1 });
moderationLogSchema.index({ source: 1 });
moderationLogSchema.index({ severity: 1 });
moderationLogSchema.index({ acknowledged: 1 });

// Static method to get user's moderation history
moderationLogSchema.statics.getUserHistory = function(userId, limit = 50) {
  return this.find({ targetUser: userId })
    .populate('room', 'name')
    .populate('performedBy', 'username')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get room moderation logs
moderationLogSchema.statics.getRoomLogs = function(roomId, limit = 100) {
  return this.find({ room: roomId })
    .populate('targetUser', 'username')
    .populate('performedBy', 'username')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get unacknowledged logs for admin
moderationLogSchema.statics.getUnacknowledgedLogs = function(limit = 100) {
  return this.find({ acknowledged: false, severity: { $in: ['high', 'critical'] } })
    .populate('targetUser', 'username email')
    .populate('room', 'name')
    .populate('message', 'content')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get moderation statistics
moderationLogSchema.statics.getStats = async function(startDate, endDate) {
  const match = {};
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalActions: { $sum: 1 },
        byAction: { $push: '$action' },
        bySource: { $push: '$source' },
        bySeverity: { $push: '$severity' }
      }
    }
  ]);

  if (stats.length === 0) {
    return { totalActions: 0, byAction: {}, bySource: {}, bySeverity: {} };
  }

  const countOccurrences = arr => arr.reduce((acc, val) => {
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});

  return {
    totalActions: stats[0].totalActions,
    byAction: countOccurrences(stats[0].byAction),
    bySource: countOccurrences(stats[0].bySource),
    bySeverity: countOccurrences(stats[0].bySeverity)
  };
};

module.exports = mongoose.model('ModerationLog', moderationLogSchema);
