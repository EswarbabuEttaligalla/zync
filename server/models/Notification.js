const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    default: null,
    index: true,
  },
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  type: {
    type: String,
    enum: [
      'speaker-request',
      'speaker-approved',
      'speaker-rejected',
      'moderator-assigned',
      'moderator-removed',
      'user-muted',
      'user-unmuted',
      'room-invite',
      'mention',
      'reaction',
      'moderation-warning',
    ],
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    maxlength: 120,
  },
  body: {
    type: String,
    required: true,
    maxlength: 500,
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  readAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });

notificationSchema.methods.markRead = function() {
  this.readAt = new Date();
  return this;
};

module.exports = mongoose.model('Notification', notificationSchema);
