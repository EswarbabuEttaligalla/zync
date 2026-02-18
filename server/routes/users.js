/**
 * User Routes
 * User profile, settings, and statistics
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { profileUpdateValidation } = require('../middleware/validation');

/**
 * @route   GET /api/users/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  res.json({ user: user.getPublicProfile() });
}));

/**
 * @route   PUT /api/users/me
 * @desc    Update current user profile
 * @access  Private
 */
router.put('/me', asyncHandler(async (req, res) => {
  const { firstName, lastName, bio, location, website, avatar } = req.body;

  const updates = {};
  if (firstName !== undefined) updates['profile.firstName'] = firstName;
  if (lastName !== undefined) updates['profile.lastName'] = lastName;
  if (bio !== undefined) updates['profile.bio'] = bio;
  if (location !== undefined) updates['profile.location'] = location;
  if (website !== undefined) updates['profile.website'] = website;
  if (avatar !== undefined) updates['profile.avatar'] = avatar;

  const user = await User.findByIdAndUpdate(
    req.userId,
    { $set: updates },
    { new: true, runValidators: true }
  );

  res.json({ user: user.getPublicProfile() });
}));

/**
 * @route   PUT /api/users/me/settings
 * @desc    Update user settings
 * @access  Private
 */
router.put('/me/settings', asyncHandler(async (req, res) => {
  const { emailNotifications, showOnlineStatus, privateProfile } = req.body;

  const settings = {};
  if (emailNotifications !== undefined) settings['settings.emailNotifications'] = emailNotifications;
  if (showOnlineStatus !== undefined) settings['settings.showOnlineStatus'] = showOnlineStatus;
  if (privateProfile !== undefined) settings['settings.privateProfile'] = privateProfile;

  const user = await User.findByIdAndUpdate(
    req.userId,
    { $set: settings },
    { new: true }
  );

  res.json({ settings: user.settings });
}));

/**
 * @route   PUT /api/users/me/password
 * @desc    Change password
 * @access  Private
 */
router.put('/me/password', asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError('Both current and new passwords are required', 400);
  }

  if (newPassword.length < 8) {
    throw new AppError('New password must be at least 8 characters', 400);
  }

  const user = await User.findById(req.userId).select('+password');
  const isMatch = await user.comparePassword(currentPassword);

  if (!isMatch) {
    throw new AppError('Current password is incorrect', 401);
  }

  user.password = newPassword;
  await user.save();

  res.json({ message: 'Password updated successfully' });
}));

/**
 * @route   GET /api/users/me/stats
 * @desc    Get detailed user statistics
 * @access  Private
 */
router.get('/me/stats', asyncHandler(async (req, res) => {
  const userId = req.userId;

  const [
    roomsCreated,
    roomsJoined,
    messagesCount,
    recentRooms
  ] = await Promise.all([
    Room.countDocuments({ host: userId }),
    Room.countDocuments({ 'participants.user': userId }),
    Message.countDocuments({
      sender: userId,
      isDeleted: false,
      status: { $nin: ['blocked', 'pending', 'pending_review'] }
    }),
    Room.find({ 'participants.user': userId })
      .select('name topic category createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
  ]);

  // Get message activity by day (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const messageActivity = await Message.aggregate([
    {
      $match: {
        sender: req.user._id,
        isDeleted: false,
        status: { $nin: ['blocked', 'pending', 'pending_review'] },
        createdAt: { $gte: weekAgo }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.json({
    stats: {
      roomsCreated,
      roomsJoined,
      messagesCount,
      warningsReceived: req.user.stats.warningsReceived,
      debatesParticipated: req.user.stats.debatesParticipated
    },
    recentRooms,
    messageActivity
  });
}));

/**
 * @route   GET /api/users/:userId
 * @desc    Get public profile of a user
 * @access  Private
 */
router.get('/:userId', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.settings.privateProfile && user._id.toString() !== req.userId) {
    return res.json({
      user: {
        id: user._id,
        username: user.username,
        profile: { avatar: user.profile.avatar },
        isPrivate: true
      }
    });
  }

  res.json({ user: user.getPublicProfile() });
}));

/**
 * @route   GET /api/users/me/dashboard
 * @desc    Get dashboard data for current user
 * @access  Private
 */
router.get('/me/dashboard', asyncHandler(async (req, res) => {
  const userId = req.userId;

  const [
    myRooms,
    joinedRooms,
    recentMessages,
    totalMessages
  ] = await Promise.all([
    Room.find({ host: userId, isActive: true })
      .populate('host', 'username')
      .sort({ createdAt: -1 })
      .limit(10),
    Room.find({ 
      'participants.user': userId,
      host: { $ne: userId },
      isActive: true 
    })
      .populate('host', 'username profile.avatar')
      .sort({ updatedAt: -1 })
      .limit(10),
    Message.find({
      sender: userId,
      isDeleted: false,
      status: { $nin: ['blocked', 'pending', 'pending_review'] }
    })
      .populate('room', 'name roomId')
      .sort({ createdAt: -1 })
      .limit(5),
    Message.countDocuments({
      sender: userId,
      isDeleted: false,
      status: { $nin: ['blocked', 'pending', 'pending_review'] }
    })
  ]);

  res.json({
    myRooms,
    joinedRooms,
    recentMessages,
    stats: {
      totalMessages,
      roomsCreated: myRooms.length,
      roomsJoined: joinedRooms.length,
      warningsReceived: req.user.stats.warningsReceived
    }
  });
}));

module.exports = router;
