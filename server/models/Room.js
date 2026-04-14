/**
 * Room Model
 * Handles debate rooms and their configurations
 */

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const rolePriority = {
  viewer: 0,
  participant: 1,
  moderator: 2,
  owner: 3,
};

const toId = (value) => value?.toString?.() || value;

const toPlainParticipant = (participant) => {
  if (!participant) return null;

  if (typeof participant.toObject === 'function') {
    return participant.toObject({ depopulate: true, getters: false, virtuals: false });
  }

  return { ...participant };
};

const pickMoreRecentDate = (left, right) => {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;
  return rightTime > leftTime ? right : left;
};

const normalizeParticipantList = (participants = []) => {
  const map = new Map();

  participants.forEach((participant) => {
    const plainParticipant = toPlainParticipant(participant);
    if (!plainParticipant) return;

    const userId = toId(plainParticipant.user);
    if (!userId) return;

    const existing = map.get(userId);
    if (!existing) {
      map.set(userId, { ...plainParticipant, user: plainParticipant.user });
      return;
    }

    const currentRole = existing.role || 'viewer';
    const incomingRole = plainParticipant.role || 'viewer';
    const mergedRole = rolePriority[incomingRole] > rolePriority[currentRole] ? incomingRole : currentRole;

    map.set(userId, {
      ...existing,
      ...plainParticipant,
      user: existing.user || participant.user,
      role: mergedRole,
      joinedAt: pickMoreRecentDate(existing.joinedAt, plainParticipant.joinedAt),
      lastSeenAt: pickMoreRecentDate(existing.lastSeenAt, plainParticipant.lastSeenAt),
    });
  });

  return Array.from(map.values());
};

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
      enum: ['owner', 'moderator', 'participant', 'viewer'],
      default: 'viewer'
    },
    isOnline: { type: Boolean, default: false },
    socketId: { type: String, default: null },
    lastSeenAt: { type: Date, default: null },
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
  this.participants = normalizeParticipantList(this.participants);
  const normalizedUserId = userId.toString();
  const existingParticipant = this.participants.find((participant) => participant.user.toString() === normalizedUserId);
  
  if (!existingParticipant) {
    this.participants.push({ user: userId, role });
    if (this.participants.length > this.stats.peakParticipants) {
      this.stats.peakParticipants = this.participants.length;
    }
  } else if (role && role !== existingParticipant.role) {
    existingParticipant.role = role;
  }
  return this;
};

roomSchema.methods.upsertParticipant = function(userId, updates = {}) {
  this.participants = normalizeParticipantList(this.participants);
  const participant = this.participants.find((entry) => entry.user.toString() === userId.toString());
  if (!participant) {
    const nextParticipant = {
      user: userId,
      role: updates.role || 'viewer',
      joinedAt: updates.joinedAt || new Date(),
      isMuted: updates.isMuted || false,
      mutedUntil: updates.mutedUntil || null,
      muteReason: updates.muteReason || null,
      violationCount: updates.violationCount || 0,
      isOnline: updates.isOnline || false,
      socketId: updates.socketId || null,
      lastSeenAt: updates.lastSeenAt || null,
    };
    this.participants.push(nextParticipant);
    if (this.participants.length > this.stats.peakParticipants) {
      this.stats.peakParticipants = this.participants.length;
    }
    this.participants = normalizeParticipantList(this.participants);
    return nextParticipant;
  }

  Object.assign(participant, updates);
  this.participants = normalizeParticipantList(this.participants);
  return participant;
};

// Method to remove participant
roomSchema.methods.removeParticipant = function(userId) {
  this.participants = this.participants.filter(
    p => p.user.toString() !== userId.toString()
  );
  return this;
};

roomSchema.methods.compactParticipants = function() {
  this.participants = normalizeParticipantList(this.participants);
  this.moderators = Array.from(new Set((this.moderators || []).map((moderator) => moderator.toString())));
  return this;
};

// Method to check if user is participant
roomSchema.methods.isParticipant = function(userId) {
  return normalizeParticipantList(this.participants).some(
    (participant) => participant.user.toString() === userId.toString()
  );
};

// Method to check if user is moderator
roomSchema.methods.isModerator = function(userId) {
  return this.host.toString() === userId.toString() ||
    this.moderators.some(m => m.toString() === userId.toString());
};

roomSchema.methods.getMemberRole = function(userId) {
  if (this.host.toString() === userId.toString()) {
    return 'owner';
  }

  if (this.moderators.some(m => m.toString() === userId.toString())) {
    return 'moderator';
  }

  const participant = this.getParticipantRecord(userId);
  return participant?.role || 'viewer';
};

roomSchema.methods.getParticipantRecord = function(userId) {
  const normalized = normalizeParticipantList(this.participants);
  const matches = normalized.filter((participant) => participant.user.toString() === userId.toString());
  if (matches.length === 0) return null;

  return matches.reduce((highest, current) => {
    const highestRole = highest.role || 'viewer';
    const currentRole = current.role || 'viewer';

    if (rolePriority[currentRole] > rolePriority[highestRole]) {
      return current;
    }

    if (rolePriority[currentRole] < rolePriority[highestRole]) {
      return highest;
    }

    return pickMoreRecentDate(highest.lastSeenAt || highest.joinedAt, current.lastSeenAt || current.joinedAt) === current.lastSeenAt || current.joinedAt
      ? current
      : highest;
  });
};

roomSchema.methods.canSendMessage = function(userId) {
  const role = this.getMemberRole(userId);
  return ['owner', 'moderator', 'participant'].includes(role);
};

roomSchema.methods.canReact = function(userId) {
  const role = this.getMemberRole(userId);
  return ['owner', 'moderator', 'participant', 'viewer'].includes(role);
};

roomSchema.methods.canModerate = function(userId) {
  return this.host.toString() === userId.toString() ||
    this.moderators.some(m => m.toString() === userId.toString());
};

roomSchema.pre('save', function(next) {
  this.participants = normalizeParticipantList(this.participants);
  this.moderators = Array.from(new Set((this.moderators || []).map((moderator) => moderator.toString())));
  next();
});

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
