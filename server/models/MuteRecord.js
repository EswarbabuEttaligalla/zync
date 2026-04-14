const mongoose = require('mongoose');

const muteRecordSchema = new mongoose.Schema({
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
    index: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  moderator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  reason: {
    type: String,
    maxlength: 300,
    default: '',
  },
  startsAt: {
    type: Date,
    default: Date.now,
  },
  endsAt: {
    type: Date,
    default: null,
  },
  active: {
    type: Boolean,
    default: true,
    index: true,
  },
}, {
  timestamps: true,
});

muteRecordSchema.index({ room: 1, user: 1, active: 1 });

muteRecordSchema.methods.expire = function() {
  this.active = false;
  this.endsAt = new Date();
  return this;
};

module.exports = mongoose.model('MuteRecord', muteRecordSchema);
