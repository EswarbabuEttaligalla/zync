/**
 * JoinRequest Model
 * Handles room join requests for private rooms
 */

const mongoose = require('mongoose');

const joinRequestSchema = new mongoose.Schema({
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    maxlength: [500, 'Request message cannot exceed 500 characters']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: { type: Date },
  rejectionReason: { type: String, maxlength: 300 }
}, {
  timestamps: true
});

// Compound index to prevent duplicate requests
joinRequestSchema.index({ room: 1, user: 1 }, { unique: true });
joinRequestSchema.index({ status: 1 });
joinRequestSchema.index({ room: 1, status: 1 });

// Static method to get pending requests for a room
joinRequestSchema.statics.getPendingRequests = function(roomId) {
  return this.find({ room: roomId, status: 'pending' })
    .populate('user', 'username profile.avatar profile.bio stats')
    .sort({ createdAt: 1 });
};

// Method to approve request
joinRequestSchema.methods.approve = function(processedById) {
  this.status = 'approved';
  this.processedBy = processedById;
  this.processedAt = new Date();
  return this;
};

// Method to reject request
joinRequestSchema.methods.reject = function(processedById, reason) {
  this.status = 'rejected';
  this.processedBy = processedById;
  this.processedAt = new Date();
  this.rejectionReason = reason;
  return this;
};

module.exports = mongoose.model('JoinRequest', joinRequestSchema);
