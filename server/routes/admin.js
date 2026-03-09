/**
 * Admin Routes
 * Administrative functions and moderation dashboard
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');
const ModerationLog = require('../models/ModerationLog');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const serializeUser = (user) => ({
  ...user.toObject(),
  isBanned: user.status === 'banned',
  isSuspended: user.status === 'suspended',
  stats: {
    ...user.stats,
    totalMessages: user.stats?.messagesSent || 0,
  },
});

const serializeMessage = (message) => ({
  ...message.toObject(),
  user: message.sender,
  sender: message.sender,
  flagReason: message.moderation?.toxicity?.flagged ? 'Flagged by AI' : message.status,
  aiAnalysis: message.moderation,
});

const updateUserStatus = async ({ userId, status, reason, req }) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.role === 'admin') {
    throw new AppError('Cannot modify admin accounts', 403);
  }

  const previousStatus = user.status;
  user.status = status;
  await user.save();

  await ModerationLog.create({
    action: 'user-status-updated',
    source: 'admin',
    performedBy: req.userId,
    targetUser: user._id,
    severity: status === 'banned' ? 'high' : status === 'suspended' ? 'medium' : 'low',
    details: { previousStatus, newStatus: status, reason }
  });

  return user;
};

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
    throw new AppError('Admin access required', 403);
  }
  next();
};

router.use(requireAdmin);

/**
 * @route   GET /api/admin/stats
 * @desc    Get platform statistics
 * @access  Admin
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    totalUsers,
    activeUsers,
    newUsersToday,
    totalRooms,
    activeRooms,
    totalMessages,
    messagesToday,
    flaggedMessages,
    bannedUsers
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ lastActive: { $gte: weekAgo } }),
    User.countDocuments({ createdAt: { $gte: today } }),
    Room.countDocuments(),
    Room.countDocuments({ status: 'active' }),
    Message.countDocuments(),
    Message.countDocuments({ createdAt: { $gte: today } }),
    Message.countDocuments({ 'moderation.toxicity.flagged': true }),
    User.countDocuments({ status: 'banned' })
  ]);

  // Category distribution
  const categoryStats = await Room.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  // Daily activity (last 7 days)
  const dailyMessages = await Message.aggregate([
    { $match: { createdAt: { $gte: weekAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const dailyUsers = await User.aggregate([
    { $match: { createdAt: { $gte: weekAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.json({
    totalUsers,
    activeUsers,
    newUsersToday,
    totalRooms,
    activeRooms,
    totalMessages,
    messagesToday,
    flaggedMessages,
    flaggedCount: flaggedMessages,
    bannedUsers,
    overview: {
      totalUsers,
      activeUsers,
      newUsersToday,
      totalRooms,
      activeRooms,
      totalMessages,
      messagesToday,
      flaggedMessages,
      bannedUsers
    },
    categoryStats,
    activity: {
      dailyMessages,
      dailyUsers
    }
  });
}));

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with pagination
 * @access  Admin
 */
router.get('/users', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const { status, role, search } = req.query;

  const query = {};
  if (status) query.status = status;
  if (role) query.role = role;
  if (search) {
    query.$or = [
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-refreshToken -emailVerificationToken')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(query)
  ]);

  res.json({
    users: users.map(serializeUser),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
}));

/**
 * @route   PUT /api/admin/users/:userId/status
 * @desc    Update user status (ban, suspend, activate)
 * @access  Admin
 */
router.put('/users/:userId/status', asyncHandler(async (req, res) => {
  const { status, reason } = req.body;

  if (!['active', 'suspended', 'banned'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  const user = await updateUserStatus({
    userId: req.params.userId,
    status,
    reason,
    req,
  });

  res.json({ message: `User ${status} successfully`, user: serializeUser(user) });
}));

router.put('/users/:userId/ban', asyncHandler(async (req, res) => {
  const user = await updateUserStatus({
    userId: req.params.userId,
    status: 'banned',
    reason: req.body.reason,
    req,
  });

  res.json({ message: 'User banned successfully', user: serializeUser(user) });
}));

router.put('/users/:userId/unban', asyncHandler(async (req, res) => {
  const user = await updateUserStatus({
    userId: req.params.userId,
    status: 'active',
    reason: req.body.reason,
    req,
  });

  res.json({ message: 'User unbanned successfully', user: serializeUser(user) });
}));

/**
 * @route   PUT /api/admin/users/:userId/role
 * @desc    Update user role
 * @access  Admin
 */
router.put('/users/:userId/role', asyncHandler(async (req, res) => {
  const { role } = req.body;

  if (!['user', 'moderator', 'admin'].includes(role)) {
    throw new AppError('Invalid role', 400);
  }

  // Only super admins can create new admins
  if (role === 'admin' && req.user.role !== 'admin') {
    throw new AppError('Only admins can create admin accounts', 403);
  }

  const user = await User.findByIdAndUpdate(
    req.params.userId,
    { role },
    { new: true }
  );

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({ message: 'Role updated successfully', user: serializeUser(user) });
}));

/**
 * @route   GET /api/admin/rooms
 * @desc    Get all rooms with details
 * @access  Admin
 */
router.get('/rooms', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const { status, category } = req.query;

  const query = {};
  if (status) query.status = status;
  if (category) query.category = category;

  const [rooms, total] = await Promise.all([
    Room.find(query)
      .populate('host', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Room.countDocuments(query)
  ]);

  res.json({
    rooms,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
}));

/**
 * @route   DELETE /api/admin/rooms/:roomId
 * @desc    Delete/Archive a room
 * @access  Admin
 */
router.delete('/rooms/:roomId', asyncHandler(async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  room.status = 'archived';
  room.isActive = false;
  await room.save();

  await ModerationLog.create({
    action: 'room-archived',
    source: 'admin',
    performedBy: req.userId,
    targetUser: room.host,
    room: room._id,
    severity: 'low',
    details: { reason: req.body.reason || 'Archived by admin' }
  });

  res.json({ message: 'Room archived successfully' });
}));

/**
 * @route   GET /api/admin/moderation
 * @desc    Get flagged content for review
 * @access  Admin
 */
router.get('/moderation', asyncHandler(async (req, res) => {
  const flaggedMessages = await Message.find({
    'moderation.toxicity.flagged': true,
    status: { $ne: 'deleted' }
  })
    .populate('sender', 'username email stats.warningsReceived')
    .populate('room', 'name roomId')
    .sort({ createdAt: -1 })
    .limit(50);

  const recentLogs = await ModerationLog.find()
    .populate('performedBy', 'username')
    .populate('targetUser', 'username')
    .sort({ createdAt: -1 })
    .limit(20);

  res.json({
    flaggedMessages,
    recentLogs
  });
}));

router.get('/messages/flagged', asyncHandler(async (req, res) => {
  const flaggedMessages = await Message.find({
    'moderation.toxicity.flagged': true,
    status: { $nin: ['deleted'] }
  })
    .populate('sender', 'username email stats.warningsReceived profile.avatar')
    .populate('room', 'name roomId')
    .sort({ createdAt: -1 })
    .limit(50);

  res.json({
    messages: flaggedMessages.map(serializeMessage)
  });
}));

router.put('/messages/:messageId/approve', asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.messageId).populate('sender', 'username');

  if (!message) {
    throw new AppError('Message not found', 404);
  }

  message.status = 'approved';
  message.moderation = {
    ...(message.moderation || {}),
    toxicity: {
      ...(message.moderation?.toxicity || {}),
      flagged: false
    }
  };
  await message.save();

  await ModerationLog.create({
    action: 'message-approved',
    source: 'admin',
    performedBy: req.userId,
    targetUser: message.sender._id,
    message: message._id,
    severity: 'low',
    details: {
      notes: 'Admin approved message',
    }
  });

  res.json({ message: 'Message approved successfully', data: serializeMessage(message) });
}));

router.delete('/messages/:messageId', asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.messageId).populate('sender', 'username');

  if (!message) {
    throw new AppError('Message not found', 404);
  }

  message.isDeleted = true;
  message.deletedAt = new Date();
  message.deletedBy = req.userId;
  await message.save();

  await ModerationLog.create({
    action: 'message-deleted',
    source: 'admin',
    performedBy: req.userId,
    targetUser: message.sender._id,
    message: message._id,
    severity: 'medium',
    details: {
      notes: 'Admin deleted message',
    }
  });

  res.json({ message: 'Message deleted successfully' });
}));

/**
 * @route   PUT /api/admin/moderation/:logId/override
 * @desc    Mark a moderation decision as reviewed/overridden
 * @access  Admin
 */
router.put('/moderation/:logId/override', asyncHandler(async (req, res) => {
  const { notes, response } = req.body;

  const log = await ModerationLog.findById(req.params.logId);
  if (!log) {
    throw new AppError('Moderation log not found', 404);
  }

  log.acknowledged = true;
  log.acknowledgedAt = new Date();
  log.acknowledgedBy = req.userId;
  log.appealed = true;
  log.appealStatus = 'approved';
  log.appealReason = notes || response || 'Admin override requested';
  log.appealResponse = response || 'Approved by admin override';
  log.details = {
    ...(log.details || {}),
    notes: response || notes || 'Approved by admin override',
  };
  await log.save();

  await ModerationLog.create({
    targetUser: log.targetUser,
    room: log.room,
    message: log.message,
    action: 'ai-override',
    severity: log.severity,
    source: 'admin',
    performedBy: req.userId,
    details: {
      reason: notes || response || 'Admin override requested',
      notes: response || notes || 'Approved by admin override',
    },
  });

  res.json({ message: 'Moderation decision overridden successfully', log });
}));

/**
 * @route   PUT /api/admin/messages/:messageId/review
 * @desc    Review and take action on flagged message
 * @access  Admin
 */
router.put('/messages/:messageId/review', asyncHandler(async (req, res) => {
  const { action, reason } = req.body;

  if (!['approve', 'delete', 'warn'].includes(action)) {
    throw new AppError('Invalid action', 400);
  }

  const message = await Message.findById(req.params.messageId)
    .populate('sender', 'username');

  if (!message) {
    throw new AppError('Message not found', 404);
  }

  if (action === 'approve') {
    message.status = 'approved';
    message.moderation.toxicity.flagged = false;
  } else if (action === 'delete') {
    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = req.userId;
  } else if (action === 'warn') {
    // Increment user warning count
    await User.findByIdAndUpdate(message.sender._id, {
      $inc: { 'stats.warningsReceived': 1 }
    });
  }

  await message.save();

  await ModerationLog.create({
    action: action === 'approve' ? 'message-approved' : action === 'delete' ? 'message-deleted' : 'warning-issued',
    source: 'admin',
    performedBy: req.userId,
    targetUser: message.sender._id,
    message: message._id,
    severity: action === 'approve' ? 'low' : action === 'delete' ? 'medium' : 'low',
    details: { reason }
  });

  res.json({ message: `Message ${action}d successfully` });
}));

/**
 * @route   GET /api/admin/analytics
 * @desc    Get detailed analytics
 * @access  Admin
 */
router.get('/analytics', asyncHandler(async (req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Content moderation stats
  const moderationStats = await Message.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        flagged: {
          $sum: { $cond: ['$moderation.toxicity.flagged', 1, 0] }
        },
        blocked: {
          $sum: { $cond: [{ $eq: ['$status', 'blocked'] }, 1, 0] }
        },
        fallaciesDetected: {
          $sum: { $cond: ['$moderation.fallacy.detected', 1, 0] }
        },
        factChecked: {
          $sum: { $cond: ['$moderation.factCheck.performed', 1, 0] }
        }
      }
    }
  ]);

  // Top active rooms
  const topRooms = await Message.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: '$room', messageCount: { $sum: 1 } } },
    { $sort: { messageCount: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'rooms',
        localField: '_id',
        foreignField: '_id',
        as: 'roomDetails'
      }
    },
    { $unwind: '$roomDetails' },
    {
      $project: {
        name: '$roomDetails.name',
        topic: '$roomDetails.topic',
        messageCount: 1
      }
    }
  ]);

  // User engagement
  const userEngagement = await User.aggregate([
    {
      $group: {
        _id: null,
        avgMessages: { $avg: '$stats.messagesSent' },
        avgRoomsJoined: { $avg: '$stats.roomsJoined' },
        avgWarnings: { $avg: '$stats.warningsReceived' }
      }
    }
  ]);

  res.json({
    moderation: moderationStats[0] || {},
    topRooms,
    userEngagement: userEngagement[0] || {}
  });
}));

module.exports = router;
