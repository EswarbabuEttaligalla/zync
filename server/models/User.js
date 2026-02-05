/**
 * User Model
 * Handles user profiles, authentication, and permissions
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Don't return password by default
  },
  profile: {
    firstName: { type: String, trim: true, maxlength: 50 },
    lastName: { type: String, trim: true, maxlength: 50 },
    bio: { type: String, maxlength: 500 },
    avatar: { type: String, default: null },
    location: { type: String, maxlength: 100 },
    website: { type: String, maxlength: 200 }
  },
  role: {
    type: String,
    enum: ['user', 'moderator', 'admin'],
    default: 'user'
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'banned', 'pending'],
    default: 'active'
  },
  stats: {
    roomsCreated: { type: Number, default: 0 },
    roomsJoined: { type: Number, default: 0 },
    messagesSent: { type: Number, default: 0 },
    warningsReceived: { type: Number, default: 0 },
    debatesParticipated: { type: Number, default: 0 },
    factsContributed: { type: Number, default: 0 }
  },
  settings: {
    emailNotifications: { type: Boolean, default: true },
    showOnlineStatus: { type: Boolean, default: true },
    privateProfile: { type: Boolean, default: false }
  },
  lastLogin: { type: Date },
  lastActive: { type: Date },
  refreshToken: { type: String, select: false },
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String, select: false }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  if (this.profile.firstName && this.profile.lastName) {
    return `${this.profile.firstName} ${this.profile.lastName}`;
  }
  return this.username;
});

// Index for search optimization
userSchema.index({ username: 'text', email: 'text', 'profile.firstName': 'text', 'profile.lastName': 'text' });

// Pre-save hook to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile
userSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    username: this.username,
    profile: this.profile,
    stats: this.stats,
    role: this.role,
    createdAt: this.createdAt,
    lastActive: this.settings.showOnlineStatus ? this.lastActive : null
  };
};

// Static method to find by credentials
userSchema.statics.findByCredentials = async function(email, password) {
  const user = await this.findOne({ email }).select('+password');
  if (!user) {
    throw new Error('Invalid credentials');
  }
  
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }
  
  if (user.status === 'banned') {
    throw new Error('Your account has been banned');
  }
  
  if (user.status === 'suspended') {
    throw new Error('Your account is suspended');
  }
  
  return user;
};

module.exports = mongoose.model('User', userSchema);
