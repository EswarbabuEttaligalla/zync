const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');
const SpeakerRequest = require('../models/SpeakerRequest');
const Notification = require('../models/Notification');
const MuteRecord = require('../models/MuteRecord');
const ModerationLog = require('../models/ModerationLog');
const moderationService = require('../services/moderationService');
const { attachProfanityFilter } = require('../middleware/profanityFilter');
const realtime = require('../services/roomRealtimeService');

const RoomManager = require('./RoomManager');
const connectionAttempts = new Map();
const messageRateState = new Map();
const lastMessageState = new Map();
const processedEvents = new Map(); // userId -> Map(clientMessageId -> messageId)
const debugSocket = (...args) => console.debug('[socket]', ...args);

const AI_SERVER_URL = process.env.AI_SERVER_URL || '';
const SOCKET_LIMITS = {
  connectionWindowMs: Number(process.env.SOCKET_CONNECTION_WINDOW_MS || 60_000),
  connectionMaxAttempts: Number(process.env.SOCKET_CONNECTION_MAX_ATTEMPTS || 12),
  messageWindowMs: Number(process.env.SOCKET_MESSAGE_WINDOW_MS || 10_000),
  messageMaxAttempts: Number(process.env.SOCKET_MESSAGE_MAX_ATTEMPTS || 8),
};

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error('JWT_SECRET is required');
  }
  return secret;
};

const pruneWindow = (timestamps, now, windowMs) => timestamps.filter((timestamp) => now - timestamp < windowMs);

const checkSlidingWindowLimit = (stateMap, key, windowMs, maxAttempts, now = Date.now()) => {
  const timestamps = pruneWindow(stateMap.get(key) || [], now, windowMs);
  timestamps.push(now);
  stateMap.set(key, timestamps);

  if (timestamps.length > maxAttempts) {
    const retryAfterMs = windowMs - (now - timestamps[0]);
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
  }

  return { allowed: true, retryAfterMs: 0 };
};

const checkConnectionRateLimit = (socket) => {
  const key = socket.handshake.address || socket.conn?.remoteAddress || 'unknown';
  return checkSlidingWindowLimit(connectionAttempts, key, SOCKET_LIMITS.connectionWindowMs, SOCKET_LIMITS.connectionMaxAttempts);
};

const checkMessageRateLimit = (socket) => {
  const key = socket.userId || socket.id;
  return checkSlidingWindowLimit(messageRateState, key, SOCKET_LIMITS.messageWindowMs, SOCKET_LIMITS.messageMaxAttempts);
};

const checkSlowMode = ({ roomId, userId, slowModeDelaySeconds, now = Date.now() }) => {
  if (!slowModeDelaySeconds || slowModeDelaySeconds <= 0) {
    return { allowed: true, retryAfterMs: 0 };
  }

  const roomState = lastMessageState.get(roomId) || new Map();
  const lastSentAt = roomState.get(userId);

  if (lastSentAt && now - lastSentAt < slowModeDelaySeconds * 1000) {
    return { allowed: false, retryAfterMs: slowModeDelaySeconds * 1000 - (now - lastSentAt) };
  }

  roomState.set(userId, now);
  lastMessageState.set(roomId, roomState);
  return { allowed: true, retryAfterMs: 0 };
};

const getUserSessions = (userId) => RoomManager.getUserSessions(userId);
const setUserSession = (userId, socket) => RoomManager.setUserSession(userId, socket);
const removeUserSession = (userId, socketId) => RoomManager.removeUserSession(userId, socketId);
const emitToUser = (io, userId, event, payload) => RoomManager.emitToUser(io, userId, event, payload);
const addRoomMember = (roomId, userId, socketId) => RoomManager.addRoomMember(roomId, userId, socketId);
const removeRoomMember = (roomId, userId, socketId) => RoomManager.removeRoomMember(roomId, userId, socketId);
const getRoomOnlineUsers = (roomId) => RoomManager.getRoomOnlineUsers(roomId);
const getRoomTypingUsers = (roomId) => RoomManager.getRoomTypingUsers(roomId);
const emitPresenceUpdate = (io, roomId) => RoomManager.emitPresenceUpdate(io, roomId);

const saveRoomWithRetry = async (roomId, mutateRoom, maxRetries = 2) => {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const room = await loadRoom(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    try {
      await mutateRoom(room);
      await room.save();
      return room;
    } catch (error) {
      lastError = error;

      if (error?.name !== 'VersionError' || attempt === maxRetries) {
        throw error;
      }

      debugSocket('retrying stale room save', roomId, `attempt ${attempt + 1}`);
    }
  }

  throw lastError || new Error('Failed to save room');
};

const analyzeMessage = async (content, roomId, userId) => moderationService.runAiModeration({
  content,
  roomId,
  userId,
  timeout: 5000,
  aiServerUrl: AI_SERVER_URL,
  toxicityThreshold: 0.85,
});

const buildAndEmitRoomState = async (io, socket, room) => {
  const state = await realtime.buildRoomState({
    room,
    userId: socket.userId,
    onlineUsers: getRoomOnlineUsers(room._id),
    typingUsers: getRoomTypingUsers(room._id),
  });

  socket.data.lastRoomState = state;
  socket.emit('room:state', state);
  socket.emit('room:joined', state);
  emitPresenceUpdate(io, room._id);
  return state;
};

const ensureRoomParticipant = async (room, socket, role = 'viewer') => {
  const participant = room.upsertParticipant(socket.userId, {
    role,
    isOnline: true,
    socketId: socket.id,
    lastSeenAt: new Date(),
  });

  if (room.host.toString() === socket.userId.toString()) {
    participant.role = 'owner';
  } else if (room.moderators.some((id) => id.toString() === socket.userId.toString())) {
    participant.role = 'moderator';
  }

  await room.save();
  return participant;
};

const loadRoom = async (roomId) => Room.findOne({ roomId })
  .populate('host', 'username profile.avatar')
  .populate('moderators', 'username profile.avatar')
  .populate('participants.user', 'username profile.avatar');

const authenticateSocket = async (socket, next) => {
  try {
    const connectionLimit = checkConnectionRateLimit(socket);
    if (!connectionLimit.allowed) {
      return next(new Error('Socket connection rate limit exceeded'));
    }

    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const user = await User.findById(decoded.userId);
    if (!user || user.status !== 'active') {
      return next(new Error('User not found or inactive'));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
};

const validatePayload = (required = []) => (payload) => {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Malformed payload' };
  for (const key of required) {
    if (payload[key] === undefined || payload[key] === null) return { ok: false, error: `Missing ${key}` };
  }
  return { ok: true };
};

const normalizeRoomId = (value) => (typeof value === 'string' ? value.trim() : '');

const isSameRoomSession = (socket, roomId) => socket.data.currentRoomId === roomId && socket.data.joinedSocketId === socket.id;

const handleRoomJoin = async (io, socket, payload = {}, ack) => {
  const v = validatePayload(['roomId'])(payload);
  if (!v.ok) {
    debugSocket('malformed room:join payload rejected', socket.id, payload);
    if (typeof ack === 'function') ack({ ok: false, error: v.error });
    return socket.emit('error', { message: v.error });
  }
  try {
    const roomId = normalizeRoomId(payload.roomId || payload.roomIdOrCode);
    if (!roomId) {
      const response = { ok: false, error: 'Missing roomId' };
      debugSocket('malformed room:join payload rejected', socket.id, payload);
      if (typeof ack === 'function') ack(response);
      return socket.emit('error', { message: response.error });
    }

    if (isSameRoomSession(socket, roomId) && socket.data.lastRoomState) {
      debugSocket('duplicate join prevented', socket.id, roomId);
      if (typeof ack === 'function') ack({ ok: true, duplicate: true, ...socket.data.lastRoomState });
      return;
    }

    const room = await loadRoom(roomId);
    if (!room) {
      const response = { ok: false, error: 'Room not found' };
      if (typeof ack === 'function') ack(response);
      return socket.emit('error', { message: 'Room not found' });
    }

    const isMember = room.isParticipant(socket.userId) || room.isModerator(socket.userId) || room.host.toString() === socket.userId.toString();
    const isPublic = room.privacy === 'public';

    if (!isMember && !isPublic) {
      const response = { ok: false, error: 'Not authorized to join this room' };
      if (typeof ack === 'function') ack(response);
      return socket.emit('error', { message: 'Not authorized to join this room' });
    }

    const persistedRoom = await saveRoomWithRetry(room.roomId, async (currentRoom) => {
      if (!isMember) {
        currentRoom.upsertParticipant(socket.userId, {
          role: 'viewer',
          isOnline: true,
          socketId: socket.id,
          lastSeenAt: new Date(),
        });
        return;
      }

      const record = currentRoom.getParticipantRecord(socket.userId);
      if (record) {
        record.isOnline = true;
        record.socketId = socket.id;
        record.lastSeenAt = new Date();
      }
    });

    const previousRoomId = socket.data.currentRoomId;
    if (previousRoomId && previousRoomId !== room.roomId) {
      debugSocket('leaving previous room before join', socket.id, previousRoomId, '->', room.roomId);
      socket.leave(previousRoomId);
      removeRoomMember(previousRoomId, socket.userId, socket.id);
      socket.to(previousRoomId).emit('room:user_left', { userId: socket.userId, username: socket.user.username });
      emitPresenceUpdate(io, previousRoomId);
    }

    socket.join(room.roomId);
    socket.data.currentRoomId = room.roomId;
    socket.data.joinedRoomId = room.roomId;
    socket.data.joinedSocketId = socket.id;
    addRoomMember(room.roomId, socket.userId, socket.id);
    setUserSession(socket.userId, socket);
    await realtime.recordActivity({ room: room._id, actor: socket.userId, type: 'room-joined', payload: { socketId: socket.id } });
    debugSocket('room joined', socket.user.username, room.roomId, socket.id);

    socket.to(room.roomId).emit('room:user_joined', {
      userId: socket.userId,
      username: socket.user.username,
      avatar: socket.user.profile?.avatar || null,
      role: room.getMemberRole(socket.userId),
    });

    const state = await buildAndEmitRoomState(io, socket, persistedRoom);
    if (typeof ack === 'function') {
      ack({ ok: true, ...state });
    }
  } catch (error) {
    console.error('Room join error:', error);
    if (typeof ack === 'function') ack({ ok: false, error: 'Failed to join room' });
    socket.emit('error', { message: 'Failed to join room' });
  }
};

const handleSpeakerRequest = async (io, socket, payload = {}, ack) => {
  try {
    const v = validatePayload(['roomId'])(payload);
    if (!v.ok) {
      debugSocket('malformed speaker:request payload rejected', socket.id, payload);
      if (typeof ack === 'function') ack({ ok: false, error: v.error });
      return;
    }
    const room = await loadRoom(normalizeRoomId(payload.roomId));
    if (!room) throw new Error('Room not found');

    const role = room.getMemberRole(socket.userId);
    if (role !== 'viewer') {
      const response = { ok: false, error: 'Only viewers can request speaker access' };
      if (typeof ack === 'function') ack(response);
      return;
    }

    const message = (payload.message || '').trim();
    const existing = await SpeakerRequest.findOne({ room: room._id, user: socket.userId, status: 'pending' });
    if (existing) {
      const response = { ok: false, error: 'Speaker request already pending' };
      if (typeof ack === 'function') ack(response);
      return;
    }

    const request = await SpeakerRequest.create({ room: room._id, user: socket.userId, message });
    await realtime.recordActivity({ room: room._id, actor: socket.userId, type: 'speaker-requested', payload: { requestId: request._id } });
    debugSocket('speaker requested', socket.user.username, room.roomId, request._id.toString());

    const notification = await realtime.ensureNotification({
      recipient: room.host,
      room: room._id,
      actor: socket.userId,
      type: 'speaker-request',
      title: 'User requested speaker access',
      body: `${socket.user.username} requested speaker access${message ? `: ${message}` : ''}`,
      data: { requestId: request._id.toString(), userId: socket.userId },
    });

    emitToUser(io, room.host.toString(), 'notification:new', notification);
    io.to(room.roomId).emit('notification:new', {
      ...notification.toObject(),
      recipient: room.host,
    });
    const requestPayload = {
      requestId: request._id.toString(),
      userId: socket.userId,
      username: socket.user.username,
      avatar: socket.user.profile?.avatar || null,
      message,
      status: 'pending',
      createdAt: request.createdAt,
    };

    io.to(room.roomId).emit('speaker:request', requestPayload);
    io.to(room.roomId).emit('join-request:new', requestPayload);
    io.to(room.roomId).emit('room:state', await realtime.buildRoomState({
      room,
      userId: socket.userId,
      onlineUsers: getRoomOnlineUsers(room._id),
      typingUsers: getRoomTypingUsers(room._id),
      pendingSpeakerRequests: await SpeakerRequest.getPendingForRoom(room._id),
    }));

    if (typeof ack === 'function') ack({ ok: true, requestId: request._id });
  } catch (error) {
    console.error('Speaker request error:', error);
    if (typeof ack === 'function') ack({ ok: false, error: error.message || 'Failed to request speaker access' });
  }
};

const handleSpeakerDecision = async (io, socket, payload = {}, approve = true, ack) => {
  try {
    const v = validatePayload(['roomId', 'requestId'])(payload);
    if (!v.ok) throw new Error(v.error);
    const room = await loadRoom(normalizeRoomId(payload.roomId));
    if (!room) throw new Error('Room not found');

    if (!realtime.canApproveSpeaker(room, socket.userId) && !room.canModerate(socket.userId)) {
      throw new Error('Only the owner or assigned moderators can decide speaker access');
    }

    const request = await SpeakerRequest.findById(payload.requestId);
    if (!request || request.room.toString() !== room._id.toString()) {
      throw new Error('Speaker request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('Speaker request already processed');
    }

    if (approve) {
      request.approve(socket.userId, payload.note || '');
      room.upsertParticipant(request.user, { role: 'participant', isOnline: false, lastSeenAt: new Date() });
      room.compactParticipants();
      await room.save();
    } else {
      request.reject(socket.userId, payload.note || '');
      await request.save();
    }

    if (approve) {
      await request.save();
      await realtime.recordActivity({ room: room._id, actor: socket.userId, target: request.user, type: 'speaker-approved', payload: { requestId: request._id } });
      debugSocket('participant approved', socket.user.username, room.roomId, request.user.toString());
      const notification = await realtime.ensureNotification({
        recipient: request.user,
        room: room._id,
        actor: socket.userId,
        type: 'speaker-approved',
        title: 'Speaker access approved',
        body: 'You can now speak in the room.',
        data: { requestId: request._id.toString(), roomId: room.roomId },
      });
      emitToUser(io, request.user.toString(), 'notification:new', notification);
      const updatePayload = { requestId: request._id.toString(), userId: request.user.toString(), by: socket.userId.toString(), status: 'approved' };
      io.to(room.roomId).emit('speaker:approved', updatePayload);
      io.to(room.roomId).emit('join-request:updated', updatePayload);
    } else {
      await realtime.recordActivity({ room: room._id, actor: socket.userId, target: request.user, type: 'speaker-rejected', payload: { requestId: request._id } });
      debugSocket('participant rejected', socket.user.username, room.roomId, request.user.toString());
      const notification = await realtime.ensureNotification({
        recipient: request.user,
        room: room._id,
        actor: socket.userId,
        type: 'speaker-rejected',
        title: 'Speaker access rejected',
        body: 'Your request to speak was rejected.',
        data: { requestId: request._id.toString(), roomId: room.roomId },
      });
      emitToUser(io, request.user.toString(), 'notification:new', notification);
      const updatePayload = { requestId: request._id.toString(), userId: request.user.toString(), by: socket.userId.toString(), status: 'rejected' };
      io.to(room.roomId).emit('speaker:rejected', updatePayload);
      io.to(room.roomId).emit('join-request:updated', updatePayload);
    }

    const joined = await loadRoom(room.roomId);
    const state = await realtime.buildRoomState({
      room: joined,
      userId: socket.userId,
      onlineUsers: getRoomOnlineUsers(room._id),
      typingUsers: getRoomTypingUsers(room._id),
      pendingSpeakerRequests: await SpeakerRequest.getPendingForRoom(room._id),
    });
    socket.data.lastRoomState = state;
    io.to(room.roomId).emit('room:state', state);
    io.to(room.roomId).emit('room:participant_updated', { userId: request.user.toString(), role: approve ? 'participant' : 'viewer' });

    if (typeof ack === 'function') ack({ ok: true, requestId: request._id, approved: approve });
  } catch (error) {
    console.error('Speaker decision error:', error);
    if (typeof ack === 'function') ack({ ok: false, error: error.message || 'Failed to process speaker request' });
  }
};

const handleMessageSend = async (io, socket, payload = {}, ack) => {
  try {
    const v = validatePayload(['roomId', 'content'])(payload);
    if (!v.ok) throw new Error(v.error);
    const room = await loadRoom(normalizeRoomId(payload.roomId));
    if (!room) throw new Error('Room not found');

    if (typeof payload.content !== 'string') throw new Error('Message content must be a string');

    const content = payload.content.trim();
    if (!content) throw new Error('Message cannot be empty');

    const clientMessageId = typeof payload.clientMessageId === 'string' && payload.clientMessageId.trim()
      ? payload.clientMessageId.trim()
      : crypto.randomUUID();
    const userEvents = processedEvents.get(socket.userId) || new Map();
    if (userEvents.has(clientMessageId)) {
      const messageId = userEvents.get(clientMessageId);
      debugSocket('duplicate message emit prevented', socket.user.username, room.roomId, clientMessageId);
      if (typeof ack === 'function') ack({ ok: true, duplicate: true, messageId, clientMessageId });
      return;
    }

    if (!room.canSendMessage(socket.userId)) {
      const response = { ok: false, error: 'Speaker access required to send messages' };
      if (typeof ack === 'function') ack(response);
      socket.emit('message:blocked', { blocked: true, reason: response.error, clientMessageId });
      return;
    }

    const participant = room.getParticipantRecord(socket.userId);
    if (participant?.isMuted && (!participant.mutedUntil || participant.mutedUntil > new Date())) {
      const response = { ok: false, error: 'You are muted in this room', mutedUntil: participant.mutedUntil };
      if (typeof ack === 'function') ack(response);
      socket.emit('message:blocked', { blocked: true, reason: response.error, mutedUntil: participant.mutedUntil, clientMessageId });
      return;
    }

    const messageRateLimit = checkMessageRateLimit(socket);
    if (!messageRateLimit.allowed) {
      const response = { ok: false, error: 'Message rate limit exceeded', retryAfterMs: messageRateLimit.retryAfterMs };
      if (typeof ack === 'function') ack(response);
      socket.emit('message:blocked', { blocked: true, reason: response.error, retryAfterMs: response.retryAfterMs, clientMessageId });
      return;
    }

    const slowModeDelay = Number(room.settings?.slowModeDelay || 0);
    const slowMode = checkSlowMode({ roomId: room.roomId, userId: socket.userId, slowModeDelaySeconds: slowModeDelay });
    if (!slowMode.allowed) {
      const response = { ok: false, error: 'Slow mode is enabled', retryAfterMs: slowMode.retryAfterMs };
      if (typeof ack === 'function') ack(response);
      socket.emit('message:blocked', { blocked: true, reason: response.error, retryAfterMs: response.retryAfterMs, clientMessageId });
      return;
    }

    const normalizedContent = moderationService.normalizeText(content);
    const profanityDecision = moderationService.detectProfanity(content);
    if (profanityDecision.blocked) {
      const moderationOutcome = await moderationService.recordModerationDecision({
        room,
        user: socket.user,
        content,
        normalizedContent,
        matchedTerms: profanityDecision.matchedTerms,
        severity: profanityDecision.severity,
        action: 'message-blocked',
        source: 'system',
        reason: profanityDecision.reason,
        filterEngine: profanityDecision.filterEngine,
      });

      const response = {
        ok: false,
        blocked: true,
        reason: profanityDecision.reason,
        matchedTerms: profanityDecision.matchedTerms,
        warningCount: moderationOutcome.warningCount,
        violationCount: moderationOutcome.violationCount,
        muteApplied: moderationOutcome.muteApplied,
        mutedUntil: moderationOutcome.mutedUntil,
      };
      if (typeof ack === 'function') ack(response);
      socket.emit('message:blocked', response);
      io.to(room.roomId).emit('moderation:warning', {
        userId: socket.userId,
        roomId: room.roomId,
        reason: profanityDecision.reason,
        warningCount: moderationOutcome.warningCount,
      });
      debugSocket('message blocked by profanity filter', socket.user.username, room.roomId, clientMessageId);
      return;
    }

    const moderationDecision = await moderationService.evaluateModerationDecision({
      content,
      room,
      user: socket.user,
      userId: socket.userId,
      aiServerUrl: AI_SERVER_URL,
      timeout: 5000,
      aiModerationEnabled: Boolean(room.settings?.aiModerationEnabled),
      toxicityThreshold: room.settings?.toxicityThreshold,
    });

    if ([moderationService.MODERATION_STATES.PROFANITY_CONFIRMED, moderationService.MODERATION_STATES.TOXIC_CONFIRMED, moderationService.MODERATION_STATES.SPAM_CONFIRMED].includes(moderationDecision.state)) {
      const moderationOutcome = await moderationService.recordModerationDecision({
        room,
        user: socket.user,
        content,
        normalizedContent: moderationDecision.normalizedContent || normalizedContent,
        matchedTerms: moderationDecision.matchedTerms || profanityDecision.matchedTerms,
        severity: moderationDecision.severity || 'high',
        action: 'message-blocked',
        source: moderationDecision.state === moderationService.MODERATION_STATES.PROFANITY_CONFIRMED ? 'system' : 'ai',
        reason: moderationDecision.reason || 'Message blocked by moderation policy.',
        filterEngine: moderationDecision.filterEngine || 'ai-moderator',
        aiScores: { toxicity: moderationDecision.toxicityScore || 0 },
        factCheckResults: moderationDecision.factCheck || null,
      });

      const response = {
        ok: false,
        blocked: true,
        state: moderationDecision.state,
        status: moderationDecision.status,
        reason: moderationDecision.reason || 'Message blocked by moderation policy.',
        toxicityScore: moderationDecision.state === moderationService.MODERATION_STATES.TOXIC_CONFIRMED ? (moderationDecision.toxicityScore || 0) : 0,
        fallacies: moderationDecision.fallacies || [],
        warningCount: moderationOutcome.warningCount,
        muteApplied: moderationOutcome.muteApplied,
      };
      if (typeof ack === 'function') ack(response);
      socket.emit('message:blocked', response);
      socket.emit('moderation:warning', {
        userId: socket.userId,
        reason: response.reason,
        blocked: true,
        state: moderationDecision.state,
      });
      debugSocket('message blocked by moderation state', moderationDecision.state, socket.user.username, room.roomId, clientMessageId);
      return;
    }

    if (moderationDecision.state === moderationService.MODERATION_STATES.AI_UNAVAILABLE || moderationDecision.state === moderationService.MODERATION_STATES.PENDING_REVIEW) {
      await moderationService.logModerationDegradation({
        room,
        user: socket.user,
        content,
        normalizedContent: moderationDecision.normalizedContent || normalizedContent,
        reason: moderationDecision.reason || 'AI moderation unavailable. Message allowed under local moderation fallback.',
        source: moderationDecision.state === moderationService.MODERATION_STATES.AI_UNAVAILABLE ? 'system' : 'ai',
        aiScores: { toxicity: moderationDecision.toxicityScore || 0 },
      });

      const warning = {
        userId: socket.userId,
        roomId: room.roomId,
        reason: moderationDecision.reason || 'AI moderation unavailable. Message allowed under local moderation fallback.',
        state: moderationDecision.state,
        degraded: moderationDecision.state === moderationService.MODERATION_STATES.AI_UNAVAILABLE,
        pendingReview: moderationDecision.state === moderationService.MODERATION_STATES.PENDING_REVIEW,
        aiUnavailable: moderationDecision.state === moderationService.MODERATION_STATES.AI_UNAVAILABLE,
      };

      socket.emit('moderation:warning', warning);
      debugSocket('message allowed with non-blocking moderation state', moderationDecision.state, socket.user.username, room.roomId, clientMessageId);
    }

    const message = await Message.create({
      room: room._id,
      sender: socket.userId,
      content,
      type: payload.type || 'text',
      replyTo: payload.replyTo || undefined,
      replySnapshot: payload.replySnapshot || undefined,
      attachments: Array.isArray(payload.attachments) ? payload.attachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size,
        url: attachment.url,
        previewUrl: attachment.previewUrl || null,
        storagePath: attachment.storagePath || null,
      })) : [],
      moderation: {
        analyzed: true,
        analyzedAt: new Date(),
        state: moderationDecision.state,
        status: moderationDecision.status,
        source: moderationDecision.source,
        reason: moderationDecision.reason || null,
        pendingReview: moderationDecision.state === moderationService.MODERATION_STATES.PENDING_REVIEW,
        aiUnavailable: moderationDecision.state === moderationService.MODERATION_STATES.AI_UNAVAILABLE,
        toxicity: {
          score: moderationDecision.state === moderationService.MODERATION_STATES.TOXIC_CONFIRMED ? (moderationDecision.toxicityScore || 0) : 0,
          flagged: moderationDecision.state === moderationService.MODERATION_STATES.TOXIC_CONFIRMED,
        },
        fallacy: {
          detected: moderationDecision.hasFallacy || false,
          types: (moderationDecision.fallacies || []).map((fallacy) => ({
            name: fallacy.name || fallacy.type || 'unknown',
            confidence: fallacy.confidence || 0.7,
            explanation: fallacy.description || fallacy.explanation || '',
          })),
        },
        factCheck: {
          performed: Boolean(moderationDecision.factCheck),
          claims: (moderationDecision.factCheck?.claims || []).map((claim) => ({
            claim: claim.claim,
            verdict: claim.verdict,
            sources: claim.sources || [],
            explanation: claim.explanation || '',
          })),
        },
        aiNotes: moderationDecision.summary || moderationDecision.message || '',
      },
      status: 'approved',
    });

    room.stats.totalMessages = (room.stats.totalMessages || 0) + 1;
    if (message.moderation.toxicity.flagged) room.stats.flaggedMessages = (room.stats.flaggedMessages || 0) + 1;
    await room.save();

    socket.user.stats.messagesSent = (socket.user.stats.messagesSent || 0) + 1;
    socket.user.lastActive = new Date();
    await socket.user.save();

    await message.populate('sender', 'username profile.avatar');

    const messagePayload = {
      id: message._id.toString(),
      _id: message._id.toString(),
      clientMessageId,
      content: message.content,
      type: message.type,
      replyTo: message.replyTo,
      replySnapshot: message.replySnapshot || null,
      sender: {
        id: message.sender._id.toString(),
        _id: message.sender._id.toString(),
        username: message.sender.username,
        avatar: message.sender.profile?.avatar || null,
      },
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      status: message.status,
      reactions: message.reactions,
      attachments: message.attachments || [],
      moderation: message.moderation,
    };

    const deliveryPayload = {
      roomId: room.roomId,
      messageId: message._id.toString(),
      clientMessageId,
      status: 'delivered',
      deliveredAt: message.createdAt,
    };

    userEvents.set(clientMessageId, message._id.toString());
    processedEvents.set(socket.userId, userEvents);

    await realtime.recordActivity({ room: room._id, actor: socket.userId, type: 'message-sent', payload: { messageId: message._id } });
    debugSocket('message sent', socket.user.username, room.roomId, message._id.toString(), clientMessageId);
    socket.emit('message:sent', deliveryPayload);
    socket.emit('message:delivered', deliveryPayload);
    io.to(room.roomId).emit('message:new', messagePayload);
    if (typeof ack === 'function') ack({ ok: true, message: messagePayload, delivery: deliveryPayload });
  } catch (error) {
    console.error('Message send error:', error);
    if (typeof ack === 'function') ack({ ok: false, error: error.message || 'Failed to send message' });
    socket.emit('error', { message: 'Failed to send message' });
  }
};

const handleMessageEdit = async (io, socket, payload = {}, ack) => {
  try {
    const message = await Message.findById(payload.messageId);
    if (!message) throw new Error('Message not found');
    const room = await loadRoom(message.room.toString());
    if (!room) throw new Error('Room not found');

    const isOwner = message.sender.toString() === socket.userId.toString();
    if (!isOwner && !room.canModerate(socket.userId)) throw new Error('Not allowed to edit this message');

    const content = String(payload.content || '').trim();
    if (!content) throw new Error('Message cannot be empty');

    message.editHistory = message.editHistory || [];
    message.editHistory.push({ content: message.content, reason: payload.reason || 'edited', editedAt: new Date() });
    message.content = content;
    message.isEdited = true;
    message.status = 'modified';
    await message.save();

    const updated = await Message.findById(message._id).populate('sender', 'username profile.avatar');
    const payloadOut = {
      id: updated._id.toString(),
      _id: updated._id.toString(),
      content: updated.content,
      sender: updated.sender,
      reactions: updated.reactions,
      replyTo: updated.replyTo,
      replySnapshot: updated.replySnapshot || null,
      attachments: updated.attachments || [],
      isEdited: true,
      updatedAt: updated.updatedAt,
    };
    await realtime.recordActivity({ room: room._id, actor: socket.userId, type: 'message-edited', payload: { messageId: message._id } });
    io.to(room.roomId).emit('message:updated', payloadOut);
    if (typeof ack === 'function') ack({ ok: true, message: payloadOut });
  } catch (error) {
    if (typeof ack === 'function') ack({ ok: false, error: error.message || 'Failed to edit message' });
  }
};

const handleMessageDelete = async (io, socket, payload = {}, ack) => {
  try {
    const message = await Message.findById(payload.messageId);
    if (!message) throw new Error('Message not found');
    const room = await loadRoom(message.room.toString());
    if (!room) throw new Error('Room not found');

    const role = room.getMemberRole(socket.userId);
    const isOwner = room.host.toString() === socket.userId.toString();
    const isModerator = room.canModerate(socket.userId);
    const isParticipant = role === 'participant';
    const isOwnMessage = message.sender.toString() === socket.userId.toString();
    const canDelete = isOwner || isModerator || (isParticipant && isOwnMessage);
    if (!canDelete) throw new Error('Not allowed to delete this message');

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = socket.userId;
    message.status = 'deleted';
    await message.save();

    await realtime.recordActivity({ room: room._id, actor: socket.userId, type: 'message-deleted', payload: { messageId: message._id } });
    io.to(room.roomId).emit('message:deleted', { messageId: message._id.toString(), deletedBy: socket.userId });
    if (typeof ack === 'function') ack({ ok: true, messageId: message._id.toString() });
  } catch (error) {
    if (typeof ack === 'function') ack({ ok: false, error: error.message || 'Failed to delete message' });
  }
};

const handleMessageReact = async (io, socket, payload = {}, ack) => {
  try {
    const v = validatePayload(['messageId', 'reaction'])(payload);
    if (!v.ok) throw new Error(v.error);
    const message = await Message.findById(payload.messageId);
    if (!message) throw new Error('Message not found');
    const room = await loadRoom(message.room.toString());
    if (!room) throw new Error('Room not found');
    if (!room.canReact(socket.userId)) throw new Error('Reactions are not enabled for this role');

    const reactionType = payload.reaction || payload.type;
    if (!realtime.REACTION_TYPES.includes(reactionType)) throw new Error('Unsupported reaction type');

    const existingIndex = message.reactions.findIndex((reaction) => reaction.user.toString() === socket.userId.toString());
    let reacted = true;
    if (existingIndex >= 0 && message.reactions[existingIndex].type === reactionType) {
      message.reactions.splice(existingIndex, 1);
      reacted = false;
    } else if (existingIndex >= 0) {
      message.reactions[existingIndex].type = reactionType;
    } else {
      message.reactions.push({ user: socket.userId, type: reactionType });
    }

    await message.save();

    await message.populate('reactions.user', 'username profile.avatar');
    const counts = message.reactionCounts;
    const updated = {
      messageId: message._id.toString(),
      reactions: message.reactions.map((reaction) => ({
        userId: reaction.user._id?.toString?.() || reaction.user.toString(),
        username: reaction.user.username,
        avatar: reaction.user.profile?.avatar || null,
        type: reaction.type,
      })),
      counts,
      reacted,
    };
    await realtime.recordActivity({ room: room._id, actor: socket.userId, type: 'reaction-updated', payload: { messageId: message._id, reactionType } });
    io.to(room.roomId).emit('message:reaction_updated', updated);
    if (typeof ack === 'function') ack({ ok: true, ...updated });
  } catch (error) {
    if (typeof ack === 'function') ack({ ok: false, error: error.message || 'Failed to update reaction' });
  }
};

const handleTyping = async (io, socket, payload = {}, isTyping) => {
  const roomId = normalizeRoomId(payload.roomId || socket.data.currentRoomId);
  if (!roomId) return;

  const room = await loadRoom(roomId);
  if (!room) return;

  RoomManager.setTyping(roomId, socket.userId, socket.user.username, isTyping);

  io.to(roomId).emit('user:typing', {
    roomId,
    userId: socket.userId,
    username: socket.user.username,
    isTyping,
  });
};

const handleModeratorAssign = async (io, socket, payload = {}, ack) => {
  try {
    const room = await loadRoom(normalizeRoomId(payload.roomId));
    if (!room) throw new Error('Room not found');
    if (room.host.toString() !== socket.userId.toString()) throw new Error('Only the owner can assign moderators');

    if (!room.moderators.some((mod) => mod.toString() === payload.userId.toString())) {
      room.moderators.push(payload.userId);
    }
    room.upsertParticipant(payload.userId, { role: 'moderator' });
    room.compactParticipants();
    await room.save();

    const notification = await realtime.ensureNotification({
      recipient: payload.userId,
      room: room._id,
      actor: socket.userId,
      type: 'moderator-assigned',
      title: 'Moderator assigned',
      body: `You were assigned as a moderator in ${room.name}`,
      data: { roomId: room.roomId },
    });
    emitToUser(io, payload.userId, 'notification:new', notification);
    io.to(room.roomId).emit('notification:new', { ...notification.toObject(), recipient: payload.userId });
    const state = await realtime.buildRoomState({ room, userId: socket.userId, onlineUsers: getRoomOnlineUsers(room._id), typingUsers: getRoomTypingUsers(room._id) });
    socket.data.lastRoomState = state;
    io.to(room.roomId).emit('room:state', state);
    debugSocket('moderator assigned', socket.user.username, room.roomId, payload.userId.toString());
    if (typeof ack === 'function') ack({ ok: true });
  } catch (error) {
    if (typeof ack === 'function') ack({ ok: false, error: error.message || 'Failed to assign moderator' });
  }
};

const handleModeratorRemove = async (io, socket, payload = {}, ack) => {
  try {
    const room = await loadRoom(normalizeRoomId(payload.roomId));
    if (!room) throw new Error('Room not found');
    if (room.host.toString() !== socket.userId.toString()) throw new Error('Only the owner can remove moderators');

    room.moderators = room.moderators.filter((mod) => mod.toString() !== payload.userId.toString());
    const participant = room.getParticipantRecord(payload.userId);
    if (participant && participant.role === 'moderator') participant.role = 'viewer';
    room.compactParticipants();
    await room.save();

    const notification = await realtime.ensureNotification({
      recipient: payload.userId,
      room: room._id,
      actor: socket.userId,
      type: 'moderator-removed',
      title: 'Moderator removed',
      body: `You are no longer a moderator in ${room.name}`,
      data: { roomId: room.roomId },
    });
    emitToUser(io, payload.userId, 'notification:new', notification);
    io.to(room.roomId).emit('notification:new', { ...notification.toObject(), recipient: payload.userId });
    const state = await realtime.buildRoomState({ room, userId: socket.userId, onlineUsers: getRoomOnlineUsers(room._id), typingUsers: getRoomTypingUsers(room._id) });
    socket.data.lastRoomState = state;
    io.to(room.roomId).emit('room:state', state);
    debugSocket('moderator removed', socket.user.username, room.roomId, payload.userId.toString());
    if (typeof ack === 'function') ack({ ok: true });
  } catch (error) {
    if (typeof ack === 'function') ack({ ok: false, error: error.message || 'Failed to remove moderator' });
  }
};

const handleMuteUser = async (io, socket, payload = {}, ack) => {
  try {
    const room = await loadRoom(normalizeRoomId(payload.roomId));
    if (!room) throw new Error('Room not found');
    if (!room.canModerate(socket.userId)) throw new Error('You do not have permission to mute users');

    const participant = room.getParticipantRecord(payload.userId);
    if (!participant) throw new Error('User is not a room participant');

    const minutes = Number(payload.minutes || 15);
    const mutedUntil = new Date(Date.now() + minutes * 60 * 1000);
    participant.isMuted = true;
    participant.mutedUntil = mutedUntil;
    participant.muteReason = payload.reason || 'Muted by room moderation';
    room.compactParticipants();
    await room.save();

    await MuteRecord.create({ room: room._id, user: payload.userId, moderator: socket.userId, reason: participant.muteReason, endsAt: mutedUntil, active: true });
    const notification = await realtime.ensureNotification({
      recipient: payload.userId,
      room: room._id,
      actor: socket.userId,
      type: 'user-muted',
      title: 'You were muted',
      body: `You were muted in ${room.name}`,
      data: { roomId: room.roomId, mutedUntil, reason: participant.muteReason },
    });
    emitToUser(io, payload.userId, 'notification:new', notification);
    io.to(room.roomId).emit('user:muted', {
      userId: payload.userId,
      mutedUntil,
      reason: participant.muteReason,
      by: socket.userId,
    });
    io.to(room.roomId).emit('notification:new', { ...notification.toObject(), recipient: payload.userId });
    const state = await realtime.buildRoomState({ room, userId: socket.userId, onlineUsers: getRoomOnlineUsers(room._id), typingUsers: getRoomTypingUsers(room._id) });
    socket.data.lastRoomState = state;
    io.to(room.roomId).emit('room:state', state);
    debugSocket('participant muted', socket.user.username, room.roomId, payload.userId.toString());
    if (typeof ack === 'function') ack({ ok: true, mutedUntil });
  } catch (error) {
    if (typeof ack === 'function') ack({ ok: false, error: error.message || 'Failed to mute user' });
  }
};

const handleRoomLeave = async (io, socket, payload = {}, ack) => {
  const roomId = normalizeRoomId(payload.roomId || socket.data.currentRoomId);
  if (!roomId) {
    if (typeof ack === 'function') ack({ ok: true });
    return;
  }

  const room = await loadRoom(roomId);
  if (!room) {
    if (typeof ack === 'function') ack({ ok: true });
    return;
  }

  socket.leave(roomId);
  removeRoomMember(roomId, socket.userId, socket.id);
  RoomManager.setTyping(roomId, socket.userId, socket.user.username, false);

  const participant = room.getParticipantRecord(socket.userId);
  if (participant) {
    participant.isOnline = false;
    participant.lastSeenAt = new Date();
    participant.socketId = null;
    await room.save();
  }

  socket.data.currentRoomId = null;
  socket.data.joinedRoomId = null;
  socket.data.joinedSocketId = null;
  socket.data.lastRoomState = null;
  socket.to(roomId).emit('room:user_left', { userId: socket.userId, username: socket.user.username });
  io.to(roomId).emit('presence:update', { roomId, onlineUsers: getRoomOnlineUsers(roomId), onlineCount: getRoomOnlineUsers(roomId).length });
  await realtime.recordActivity({ room: room._id, actor: socket.userId, type: 'room-left', payload: { socketId: socket.id } });
  if (typeof ack === 'function') ack({ ok: true });
};

const initializeSocket = (io) => {
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    attachProfanityFilter(socket);

    debugSocket('connected', socket.user.username, socket.id);
    socket.data.currentRoomId = null;
    socket.data.joinedRoomId = null;
    socket.data.joinedSocketId = null;
    socket.data.lastRoomState = null;
    setUserSession(socket.userId, socket);
    socket.user.lastActive = new Date();
    socket.user.save().catch(() => {});

    socket.on('room:join', (payload, ack) => handleRoomJoin(io, socket, payload, ack));
    socket.on('room:leave', (payload, ack) => handleRoomLeave(io, socket, payload, ack));
    socket.on('speaker:request', (payload, ack) => handleSpeakerRequest(io, socket, payload, ack));
    socket.on('speaker:approve', (payload, ack) => handleSpeakerDecision(io, socket, payload, true, ack));
    socket.on('speaker:reject', (payload, ack) => handleSpeakerDecision(io, socket, payload, false, ack));
    socket.on('message:send', (payload, ack) => handleMessageSend(io, socket, payload, ack));
    socket.on('message:edit', (payload, ack) => handleMessageEdit(io, socket, payload, ack));
    socket.on('message:delete', (payload, ack) => handleMessageDelete(io, socket, payload, ack));
    socket.on('message:react', (payload, ack) => handleMessageReact(io, socket, payload, ack));
    socket.on('user:typing', (payload) => handleTyping(io, socket, payload, Boolean(payload?.isTyping)));
    socket.on('typing:start', (payload) => handleTyping(io, socket, payload, true));
    socket.on('typing:stop', (payload) => handleTyping(io, socket, payload, false));
    socket.on('moderator:assign', (payload, ack) => handleModeratorAssign(io, socket, payload, ack));
    socket.on('moderator:remove', (payload, ack) => handleModeratorRemove(io, socket, payload, ack));
    socket.on('user:mute', (payload, ack) => handleMuteUser(io, socket, payload, ack));

    socket.on('disconnect', async () => {
      debugSocket('disconnected', socket.user.username, socket.id);
      removeUserSession(socket.userId, socket.id);

      const roomId = socket.data.currentRoomId;
      if (roomId) {
        const room = await loadRoom(roomId);
        if (room) {
          const stillOnline = (RoomManager.getUserSessions(socket.userId)?.sockets?.size || 0) > 0;
          if (!stillOnline) {
            removeRoomMember(roomId, socket.userId, socket.id);
            const participant = room.getParticipantRecord(socket.userId);
            if (participant) {
              participant.isOnline = false;
              participant.lastSeenAt = new Date();
              participant.socketId = null;
              await room.save();
            }
            socket.to(roomId).emit('room:user_left', { userId: socket.userId, username: socket.user.username });
            io.to(roomId).emit('presence:update', { roomId, onlineUsers: getRoomOnlineUsers(roomId), onlineCount: getRoomOnlineUsers(roomId).length });
          }
        }
      }

      messageRateState.delete(socket.userId);
      socket.user.lastActive = new Date();
      socket.user.save().catch(() => {});
      io.emit('user:offline', { userId: socket.userId, username: socket.user.username });
    });
  });
};

module.exports = {
  initializeSocket,
  authenticateSocket,
  RoomManager: RoomManager.__internal,
  checkConnectionRateLimit,
  checkMessageRateLimit,
  checkSlowMode,
};
