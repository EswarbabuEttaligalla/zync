/**
 * Room Routes
 * Room creation, management, and join requests
 */

const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const JoinRequest = require('../models/JoinRequest');
const Message = require('../models/Message');
const SpeakerRequest = require('../models/SpeakerRequest');
const RoomManager = require('../socket/RoomManager');
const realtime = require('../services/roomRealtimeService');
const { createRoomValidation, paginationValidation } = require('../middleware/validation');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

/**
 * @route   GET /api/rooms
 * @desc    Get all public rooms with pagination
 * @access  Private
 */
router.get('/', paginationValidation, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const { category, status, search } = req.query;

  const query = { 
    privacy: 'public', 
    isActive: true 
  };

  if (category) query.category = category;
  if (status) query.status = status;
  if (search) {
    query.$text = { $search: search };
  }

  const [rooms, total] = await Promise.all([
    Room.find(query)
      .populate('host', 'username profile.avatar')
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
 * @route   GET /api/rooms/my-rooms
 * @desc    Get rooms created by current user
 * @access  Private
 */
router.get('/my-rooms', asyncHandler(async (req, res) => {
  const rooms = await Room.find({ host: req.userId })
    .sort({ createdAt: -1 });

  res.json({ rooms });
}));

/**
 * @route   GET /api/rooms/joined
 * @desc    Get rooms user has joined
 * @access  Private
 */
router.get('/joined', asyncHandler(async (req, res) => {
  const rooms = await Room.find({
    'participants.user': req.userId,
    isActive: true
  })
    .populate('host', 'username profile.avatar')
    .sort({ 'participants.joinedAt': -1 });

  res.json({ rooms });
}));

/**
 * @route   POST /api/rooms
 * @desc    Create a new room
 * @access  Private
 */
router.post('/', createRoomValidation, asyncHandler(async (req, res) => {
  const { name, description, topic, privacy, category, maxParticipants, tags, settings } = req.body;

  const room = new Room({
    name,
    description,
    topic,
    privacy: privacy || 'public',
    category: category || 'other',
    maxParticipants: maxParticipants || 50,
    tags: tags || [],
    host: req.userId,
    moderators: [req.userId],
    participants: [{
      user: req.userId,
      role: 'owner'
    }],
    settings: {
      ...settings,
      aiModerationEnabled: true,
      toxicityThreshold: 0.7,
      factCheckingEnabled: true,
      fallacyDetectionEnabled: true
    }
  });

  await room.save();

  // Update user stats
  req.user.stats.roomsCreated++;
  await req.user.save();

  // Populate host info before sending
  await room.populate('host', 'username profile.avatar');

  res.status(201).json({
    message: 'Room created successfully',
    room
  });
}));

/**
 * @route   GET /api/rooms/:roomId
 * @desc    Get room details
 * @access  Private
 */
router.get('/:roomId', asyncHandler(async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId })
    .populate('host', 'username profile.avatar')
    .populate('moderators', 'username profile.avatar')
    .populate('participants.user', 'username profile.avatar');

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  // Check access for private rooms
  if (room.privacy === 'private') {
    const isParticipant = room.isParticipant(req.userId);
    const isModerator = room.isModerator(req.userId);
    
    if (!isParticipant && !isModerator) {
      return res.json({
        room: {
          roomId: room.roomId,
          name: room.name,
          description: room.description,
          topic: room.topic,
          privacy: room.privacy,
          host: room.host,
          participantCount: room.participantCount,
          status: room.status
        },
        hasAccess: false
      });
    }
  }

  res.json({ room, hasAccess: true });
}));

/**
 * @route   PUT /api/rooms/:roomId
 * @desc    Update room settings
 * @access  Private (Host/Moderator only)
 */
router.put('/:roomId', asyncHandler(async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  if (!room.isModerator(req.userId)) {
    throw new AppError('Only moderators can update room settings', 403);
  }

  const allowedUpdates = [
    'name', 'description', 'topic', 'category', 'privacy',
    'maxParticipants', 'tags', 'settings', 'status'
  ];

  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      if (field === 'settings') {
        room.settings = { ...room.settings, ...req.body.settings };
      } else {
        room[field] = req.body[field];
      }
    }
  });

  await room.save();
  await room.populate('host', 'username profile.avatar');

  res.json({
    message: 'Room updated successfully',
    room
  });
}));

/**
 * @route   DELETE /api/rooms/:roomId
 * @desc    Delete/Archive room
 * @access  Private (Host only)
 */
router.delete('/:roomId', asyncHandler(async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  if (room.host.toString() !== req.userId.toString()) {
    throw new AppError('Only the host can delete the room', 403);
  }

  // Soft delete - archive the room
  room.isActive = false;
  room.status = 'archived';
  await room.save();

  res.json({ message: 'Room archived successfully' });
}));

/**
 * @route   POST /api/rooms/:roomId/join
 * @desc    Join a public room or request to join private room
 * @access  Private
 */
router.post('/:roomId/join', asyncHandler(async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  if (room.isParticipant(req.userId)) {
    throw new AppError('You are already a participant', 400);
  }

  if (room.isFull) {
    throw new AppError('Room is full', 400);
  }

  // For public rooms - direct join
  if (room.privacy === 'public' && !room.settings.requireApproval) {
    room.addParticipant(req.userId, 'viewer');
    await room.save();

    req.user.stats.roomsJoined++;
    await req.user.save();

    return res.json({
      message: 'Joined room successfully',
      joined: true
    });
  }

  // For private rooms or rooms requiring approval - create join request
  const existingRequest = await JoinRequest.findOne({
    room: room._id,
    user: req.userId
  });

  if (existingRequest) {
    if (existingRequest.status === 'pending') {
      throw new AppError('Join request already pending', 400);
    }
    if (existingRequest.status === 'rejected') {
      throw new AppError('Your join request was rejected', 400);
    }
  }

  const joinRequest = new JoinRequest({
    room: room._id,
    user: req.userId,
    message: req.body.message || ''
  });

  await joinRequest.save();

  const speakerRequest = await SpeakerRequest.findOneAndUpdate(
    { room: room._id, user: req.userId },
    {
      $setOnInsert: {
        room: room._id,
        user: req.userId,
        message: req.body.message || '',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const notification = await realtime.ensureNotification({
    recipient: room.host,
    room: room._id,
    actor: req.userId,
    type: 'join-request',
    title: 'Join request received',
    body: `${req.user.username} requested to join ${room.name}`,
    data: { requestId: joinRequest._id.toString(), roomId: room.roomId, speakerRequestId: speakerRequest._id.toString() },
  });

  RoomManager.emitToUser(null, room.host.toString(), 'notification:new', notification.toObject ? notification.toObject() : notification);

  const requestPayload = {
    requestId: speakerRequest._id.toString(),
    joinRequestId: joinRequest._id.toString(),
    userId: req.userId.toString(),
    username: req.user.username,
    avatar: req.user.profile?.avatar || null,
    message: req.body.message || '',
    status: 'pending',
    createdAt: joinRequest.createdAt,
  };

  RoomManager.emitToRoom(null, room.roomId, 'speaker:request', requestPayload);
  RoomManager.emitToRoom(null, room.roomId, 'join-request:new', requestPayload);

  res.json({
    message: 'Join request submitted',
    joined: false,
    requestId: joinRequest._id
  });
}));

/**
 * @route   POST /api/rooms/:roomId/leave
 * @desc    Leave a room
 * @access  Private
 */
router.post('/:roomId/leave', asyncHandler(async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  if (room.host.toString() === req.userId.toString()) {
    throw new AppError('Host cannot leave the room. Transfer ownership or delete it.', 400);
  }

  room.removeParticipant(req.userId);
  await room.save();

  res.json({ message: 'Left room successfully' });
}));

/**
 * @route   GET /api/rooms/:roomId/requests
 * @desc    Get pending join requests for a room
 * @access  Private (Moderator only)
 */
router.get('/:roomId/requests', asyncHandler(async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  if (!room.isModerator(req.userId)) {
    throw new AppError('Only moderators can view join requests', 403);
  }

  const requests = await JoinRequest.getPendingRequests(room._id);

  res.json({ requests });
}));

/**
 * @route   POST /api/rooms/:roomId/requests/:requestId/approve
 * @desc    Approve a join request
 * @access  Private (Moderator only)
 */
router.post('/:roomId/requests/:requestId/approve', asyncHandler(async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  if (!room.isModerator(req.userId)) {
    throw new AppError('Only moderators can approve requests', 403);
  }

  const joinRequest = await JoinRequest.findById(req.params.requestId);

  if (!joinRequest || joinRequest.room.toString() !== room._id.toString()) {
    throw new AppError('Join request not found', 404);
  }

  if (joinRequest.status !== 'pending') {
    throw new AppError('Request already processed', 400);
  }

  // Approve request
  joinRequest.approve(req.userId);
  await joinRequest.save();

  // Add user to room
  room.addParticipant(joinRequest.user, 'participant');
  await room.save();

  const speakerRequest = await SpeakerRequest.findOne({ room: room._id, user: joinRequest.user, status: 'pending' });
  if (speakerRequest) {
    speakerRequest.approve(req.userId);
    await speakerRequest.save();
  }

  // Update user stats
  const User = require('../models/User');
  await User.findByIdAndUpdate(joinRequest.user, {
    $inc: { 'stats.roomsJoined': 1 }
  });

  const state = await realtime.buildRoomState({
    room,
    userId: req.userId,
    onlineUsers: [],
    typingUsers: [],
    pendingSpeakerRequests: await SpeakerRequest.getPendingForRoom(room._id),
  });

  RoomManager.emitToRoom(null, room.roomId, 'speaker:approved', { requestId: speakerRequest?._id?.toString() || joinRequest._id.toString(), userId: joinRequest.user.toString(), by: req.userId.toString(), status: 'approved' });
  RoomManager.emitToRoom(null, room.roomId, 'join-request:updated', { requestId: speakerRequest?._id?.toString() || joinRequest._id.toString(), userId: joinRequest.user.toString(), by: req.userId.toString(), status: 'approved' });
  RoomManager.emitToRoom(null, room.roomId, 'room:participant_updated', { userId: joinRequest.user.toString(), role: 'participant' });
  RoomManager.emitToRoom(null, room.roomId, 'room:state', state);

  res.json({ message: 'Request approved' });
}));

/**
 * @route   POST /api/rooms/:roomId/requests/:requestId/reject
 * @desc    Reject a join request
 * @access  Private (Moderator only)
 */
router.post('/:roomId/requests/:requestId/reject', asyncHandler(async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  if (!room.isModerator(req.userId)) {
    throw new AppError('Only moderators can reject requests', 403);
  }

  const joinRequest = await JoinRequest.findById(req.params.requestId);

  if (!joinRequest || joinRequest.room.toString() !== room._id.toString()) {
    throw new AppError('Join request not found', 404);
  }

  if (joinRequest.status !== 'pending') {
    throw new AppError('Request already processed', 400);
  }

  joinRequest.reject(req.userId, req.body.reason);
  await joinRequest.save();

  const speakerRequest = await SpeakerRequest.findOne({ room: room._id, user: joinRequest.user, status: 'pending' });
  if (speakerRequest) {
    speakerRequest.reject(req.userId, req.body.reason || '');
    await speakerRequest.save();
  }

  RoomManager.emitToRoom(null, room.roomId, 'speaker:rejected', { requestId: speakerRequest?._id?.toString() || joinRequest._id.toString(), userId: joinRequest.user.toString(), by: req.userId.toString(), status: 'rejected' });
  RoomManager.emitToRoom(null, room.roomId, 'join-request:updated', { requestId: speakerRequest?._id?.toString() || joinRequest._id.toString(), userId: joinRequest.user.toString(), by: req.userId.toString(), status: 'rejected' });

  res.json({ message: 'Request rejected' });
}));

/**
 * @route   POST /api/rooms/:roomId/moderators
 * @desc    Add a moderator to the room
 * @access  Private (Host only)
 */
router.post('/:roomId/moderators', asyncHandler(async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  if (room.host.toString() !== req.userId.toString()) {
    throw new AppError('Only the host can add moderators', 403);
  }

  const { userId } = req.body;

  if (!room.isParticipant(userId)) {
    throw new AppError('User must be a participant first', 400);
  }

  if (room.moderators.includes(userId)) {
    throw new AppError('User is already a moderator', 400);
  }

  room.moderators.push(userId);
  await room.save();

  res.json({ message: 'Moderator added successfully' });
}));

/**
 * @route   DELETE /api/rooms/:roomId/moderators/:userId
 * @desc    Remove a moderator from the room
 * @access  Private (Host only)
 */
router.delete('/:roomId/moderators/:userId', asyncHandler(async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  if (room.host.toString() !== req.userId.toString()) {
    throw new AppError('Only the host can remove moderators', 403);
  }

  room.moderators = room.moderators.filter(
    m => m.toString() !== req.params.userId
  );
  await room.save();

  res.json({ message: 'Moderator removed successfully' });
}));

module.exports = router;
