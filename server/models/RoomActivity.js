const mongoose = require('mongoose');

const roomActivitySchema = new mongoose.Schema({
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
    index: true,
  },
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  target: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  type: {
    type: String,
    enum: [
      'room-created',
      'room-joined',
      'room-left',
      'speaker-requested',
      'speaker-approved',
      'speaker-rejected',
      'moderator-assigned',
      'moderator-removed',
      'user-muted',
      'user-unmuted',
      'message-sent',
      'message-edited',
      'message-deleted',
      'reaction-updated',
      'presence-updated',
    ],
    required: true,
    index: true,
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

roomActivitySchema.index({ room: 1, createdAt: -1 });

module.exports = mongoose.model('RoomActivity', roomActivitySchema);
