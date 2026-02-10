/**
 * Room Model
 * Handles debate rooms and their configurations
 */

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    unique: true,
    default: () => uuidv4()
  },
  name: {
    type: String,
    required: [true, 'Room name is required'],
    trim: true,
    minlength: [3, 'Room name must be at least 3 characters'],
    maxlength: [100, 'Room name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Room description is required'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  topic: {
    type: String,
    required: [true, 'Debate topic is required'],
    maxlength: [200, 'Topic cannot exceed 200 characters']
  },
  category: {
    type: String,
    enum: ['politics', 'technology', 'science', 'philosophy', 'society', 'economics', 'environment', 'health', 'education', 'other'],
    default: 'other'
  },
  privacy: {
    type: String,
    enum: ['public', 'private'],
    default: 'public'
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  moderators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    role: {
      type: String,
      enum: ['participant', 'spectator'],
      default: 'participant'
    },
    isMuted: {
      type: Boolean,
      default: false
    },
    mutedUntil: {
      type: Date,
      default: null
    },
    muteReason: {
      type: String,
      default: null
    },
    violationCount: {
      type: Number,
      default: 0,
      min: 0
    }
  }],
  maxParticipants: {
    type: Number,
    default: 50,
    min: 2,
    max: 200
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'paused', 'ended', 'archived'],
    default: 'waiting'
  },
  settings: {
    aiModerationEnabled: { type: Boolean, default: true },
    toxicityThreshold: { type: Number, default: 0.7, min: 0, max: 1 },
    factCheckingEnabled: { type: Boolean, default: true },
    fallacyDetectionEnabled: { type: Boolean, default: true },
    slowModeDelay: { type: Number, default: 0, min: 0, max: 60 }, // seconds between messages
    allowImages: { type: Boolean, default: false },
    allowLinks: { type: Boolean, default: true },
    requireApproval: { type: Boolean, default: true }
  },
  stats: {
    totalMessages: { type: Number, default: 0 },
    flaggedMessages: { type: Number, default: 0 },
    warningsIssued: { type: Number, default: 0 },
    factChecks: { type: Number, default: 0 },
    fallaciesDetected: { type: Number, default: 0 },
    peakParticipants: { type: Number, default: 0 }
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 30
  }],
  scheduledStart: { type: Date },
  scheduledEnd: { type: Date },
  actualStart: { type: Date },
  actualEnd: { type: Date },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for participant count
roomSchema.virtual('participantCount').get(function() {
  return this.participants.length;
});

// Virtual for checking if room is full
roomSchema.virtual('isFull').get(function() {
  return this.participants.length >= this.maxParticipants;
});

// Index for search
roomSchema.index({ name: 'text', description: 'text', topic: 'text', tags: 'text' });
roomSchema.index({ status: 1, privacy: 1, isActive: 1 });
roomSchema.index({ host: 1 });
roomSchema.index({ 'participants.user': 1 });

// Method to add participant
roomSchema.methods.addParticipant = function(userId, role = 'participant') {
  const existingParticipant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  
  if (!existingParticipant) {
    this.participants.push({ user: userId, role });
    if (this.participants.length > this.stats.peakParticipants) {
      this.stats.peakParticipants = this.participants.length;
    }
  }
  return this;
};

// Method to remove participant
roomSchema.methods.removeParticipant = function(userId) {
  this.participants = this.participants.filter(
    p => p.user.toString() !== userId.toString()
  );
  return this;
};

// Method to check if user is participant
roomSchema.methods.isParticipant = function(userId) {
  return this.participants.some(
    p => p.user.toString() === userId.toString()
  );
};

// Method to check if user is moderator
roomSchema.methods.isModerator = function(userId) {
  return this.host.toString() === userId.toString() ||
    this.moderators.some(m => m.toString() === userId.toString());
};

// Static method to get active public rooms
roomSchema.statics.getActivePublicRooms = function() {
  return this.find({
    privacy: 'public',
    status: { $in: ['waiting', 'active'] },
    isActive: true
  })
  .populate('host', 'username profile.avatar')
  .sort({ createdAt: -1 });
};

module.exports = mongoose.model('Room', roomSchema);
