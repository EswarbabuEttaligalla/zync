const mongoose = require('mongoose');

const speakerRequestSchema = new mongoose.Schema({
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
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending',
    index: true,
  },
  message: {
    type: String,
    maxlength: 500,
    default: '',
  },
  decidedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  decidedAt: {
    type: Date,
    default: null,
  },
  decisionNote: {
    type: String,
    maxlength: 300,
    default: '',
  },
}, {
  timestamps: true,
});

speakerRequestSchema.index({ room: 1, user: 1 }, { unique: true });

speakerRequestSchema.statics.getPendingForRoom = function(roomId) {
  return this.find({ room: roomId, status: 'pending' })
    .populate('user', 'username profile.avatar profile.bio stats')
    .sort({ createdAt: 1 });
};

speakerRequestSchema.methods.approve = function(processedById, note = '') {
  this.status = 'approved';
  this.decidedBy = processedById;
  this.decidedAt = new Date();
  this.decisionNote = note;
  return this;
};

speakerRequestSchema.methods.reject = function(processedById, note = '') {
  this.status = 'rejected';
  this.decidedBy = processedById;
  this.decidedAt = new Date();
  this.decisionNote = note;
  return this;
};

module.exports = mongoose.model('SpeakerRequest', speakerRequestSchema);
