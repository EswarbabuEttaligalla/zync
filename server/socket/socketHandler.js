/**
 * Socket.io Handler
 * Real-time messaging and room management
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');
const axios = require('axios');
const moderationService = require('../services/moderationService');
const { attachProfanityFilter } = require('../middleware/profanityFilter');

// Store connected users
// This in-memory state is intentionally isolated so a Redis adapter can replace it later
// without changing the socket event handlers below.
const connectedUsers = new Map();
const roomUsers = new Map();
const connectionAttempts = new Map();
const messageRateState = new Map();
const lastMessageState = new Map();

const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:8000';
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

const pruneWindow = (timestamps, now, windowMs) => timestamps.filter(timestamp => now - timestamp < windowMs);

const checkSlidingWindowLimit = (stateMap, key, windowMs, maxAttempts, now = Date.now()) => {
  const timestamps = pruneWindow(stateMap.get(key) || [], now, windowMs);
  timestamps.push(now);
  stateMap.set(key, timestamps);

  if (timestamps.length > maxAttempts) {
    const retryAfterMs = windowMs - (now - timestamps[0]);
    return {
      allowed: false,
      retryAfterMs: Math.max(retryAfterMs, 0),
    };
  }

  return { allowed: true, retryAfterMs: 0 };
};

const checkConnectionRateLimit = (socket) => {
  const key = socket.handshake.address || socket.conn?.remoteAddress || 'unknown';
  return checkSlidingWindowLimit(
    connectionAttempts,
    key,
    SOCKET_LIMITS.connectionWindowMs,
    SOCKET_LIMITS.connectionMaxAttempts
  );
};

const checkMessageRateLimit = (socket) => {
  const key = socket.userId || socket.id;
  return checkSlidingWindowLimit(
    messageRateState,
    key,
    SOCKET_LIMITS.messageWindowMs,
    SOCKET_LIMITS.messageMaxAttempts
  );
};

const checkSlowMode = ({ roomId, userId, slowModeDelaySeconds, now = Date.now() }) => {
  if (!slowModeDelaySeconds || slowModeDelaySeconds <= 0) {
    return { allowed: true, retryAfterMs: 0 };
  }

  const roomState = lastMessageState.get(roomId) || new Map();
  const lastSentAt = roomState.get(userId);

  if (lastSentAt && now - lastSentAt < slowModeDelaySeconds * 1000) {
    return {
      allowed: false,
      retryAfterMs: slowModeDelaySeconds * 1000 - (now - lastSentAt),
    };
  }

  roomState.set(userId, now);
  lastMessageState.set(roomId, roomState);
  return { allowed: true, retryAfterMs: 0 };
};

/**
 * Verify socket authentication
 */
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

/**
 * Analyze message with AI server
 */
const analyzeMessage = async (content, roomId, userId) => moderationService.runAiModeration({
  content,
  roomId,
  userId,
  timeout: 5000,
  aiServerUrl: AI_SERVER_URL,
});

/**
 * Initialize Socket.io
 */
const initializeSocket = (io) => {
  // Authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    attachProfanityFilter(socket);

    console.log(`✅ User connected: ${socket.user.username} (${socket.id})`);

    // Store connected user
    connectedUsers.set(socket.userId, {
      socketId: socket.id,
      user: socket.user,
      currentRoom: null
    });

    // Update user's online status
    socket.user.lastActive = new Date();
    socket.user.save();

    // Broadcast online status
    io.emit('user:online', {
      userId: socket.userId,
      username: socket.user.username,
      avatar: socket.user.profile?.avatar
    });

    /**
     * Join a room
     */
    socket.on('room:join', async (data) => {
      try {
        const { roomId } = data;
        const room = await Room.findOne({ roomId })
          .populate('host', 'username profile.avatar')
          .populate('participants.user', 'username profile.avatar');

        if (!room) {
          return socket.emit('error', { message: 'Room not found' });
        }

        // Check if user is participant
        const isParticipant = room.participants.some(
          p => p.user._id.toString() === socket.userId
        );

        const requiresApproval = Boolean(room.settings?.requireApproval);

        if (!isParticipant && (room.privacy === 'private' || requiresApproval)) {
          return socket.emit('error', { message: 'Not authorized to join this room' });
        }

        // Add user to participants only when the room is public and does not require approval
        if (!isParticipant && room.privacy === 'public' && !requiresApproval) {
          const alreadyExists = room.participants.some(
            p => p.user && p.user._id && p.user._id.toString() === socket.userId
          );
          if (!alreadyExists) {
            room.participants.push({
              user: socket.userId,
              role: 'participant',
              joinedAt: new Date()
            });
            await room.save();
            // Re-populate after save
            await room.populate('participants.user', 'username profile.avatar');
          }
        }

        // Leave previous room if any
        const userData = connectedUsers.get(socket.userId);
        if (userData?.currentRoom) {
          socket.leave(userData.currentRoom);
          const prevRoomUsers = roomUsers.get(userData.currentRoom) || new Set();
          prevRoomUsers.delete(socket.userId);
          roomUsers.set(userData.currentRoom, prevRoomUsers);
          
          io.to(userData.currentRoom).emit('room:user-left', {
            userId: socket.userId,
            username: socket.user.username
          });
        }

        // Join new room
        socket.join(roomId);
        userData.currentRoom = roomId;
        connectedUsers.set(socket.userId, userData);

        // Add to room users
        const currentRoomUsers = roomUsers.get(roomId) || new Set();
        currentRoomUsers.add(socket.userId);
        roomUsers.set(roomId, currentRoomUsers);

        // Get recent messages
        const messages = await Message.find(Message.visibleQuery(room._id))
          .populate('sender', 'username profile.avatar')
          .sort({ createdAt: -1 })
          .limit(50);

        // Send room data to user
        socket.emit('room:joined', {
          room: {
            ...room.toObject(),
            onlineUsers: Array.from(currentRoomUsers).map(id => {
              const user = connectedUsers.get(id);
              return user ? {
                id,
                username: user.user.username,
                avatar: user.user.profile?.avatar
              } : null;
            }).filter(Boolean)
          },
          messages: messages.reverse()
        });

        // Notify room about new user
        socket.to(roomId).emit('room:user-joined', {
          userId: socket.userId,
          username: socket.user.username,
          avatar: socket.user.profile?.avatar
        });

        console.log(`👤 ${socket.user.username} joined room: ${room.name}`);
      } catch (error) {
        console.error('Room join error:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    /**
     * Send a message
     */
    socket.on('message:send', async (data) => {
      try {
        const { roomId, content, type = 'text', moderation: localModeration } = data;

        if (!content || content.trim().length === 0) {
          return socket.emit('error', { message: 'Message cannot be empty' });
        }

        const room = await Room.findOne({ roomId });
        if (!room) {
          return socket.emit('error', { message: 'Room not found' });
        }

        // Check if user is muted
        const participant = room.participants.find(
          p => p.user.toString() === socket.userId
        );
        if (participant?.isMuted) {
          if (participant.mutedUntil && participant.mutedUntil <= new Date()) {
            participant.isMuted = false;
            participant.mutedUntil = null;
            participant.muteReason = null;
            participant.violationCount = 0;
            await room.save();
          } else {
            return socket.emit('message:blocked', {
              blocked: true,
              reason: 'You are muted in this room',
              message: 'You are muted in this room',
              warningCount: socket.user.stats.warningsReceived || 0,
            });
          }
        }

        const messageRateLimit = checkMessageRateLimit(socket);
        if (!messageRateLimit.allowed) {
          return socket.emit('message:blocked', {
            blocked: true,
            reason: 'Message rate limit exceeded. Please slow down.',
            message: 'Message rate limit exceeded. Please slow down.',
            retryAfterMs: messageRateLimit.retryAfterMs,
          });
        }

        const slowModeDelay = Number(room.settings?.slowModeDelay || 0);
        const slowMode = checkSlowMode({
          roomId: room.roomId,
          userId: socket.userId,
          slowModeDelaySeconds: slowModeDelay,
        });

        if (!slowMode.allowed) {
          return socket.emit('message:blocked', {
            blocked: true,
            reason: `Slow mode is enabled. Please wait ${Math.ceil(slowMode.retryAfterMs / 1000)} seconds before sending another message.`,
            message: `Slow mode is enabled. Please wait ${Math.ceil(slowMode.retryAfterMs / 1000)} seconds before sending another message.`,
            retryAfterMs: slowMode.retryAfterMs,
          });
        }

        const profanityDecision = localModeration || moderationService.detectProfanity(content);

        if (profanityDecision.blocked) {
          const moderationOutcome = await moderationService.recordModerationDecision({
            room,
            user: socket.user,
            content: content.trim(),
            normalizedContent: profanityDecision.normalizedContent,
            matchedTerms: profanityDecision.matchedTerms,
            severity: profanityDecision.severity,
            action: 'message-blocked',
            source: 'system',
            reason: profanityDecision.reason,
            filterEngine: profanityDecision.filterEngine,
          });

          return socket.emit('message:blocked', {
            blocked: true,
            reason: profanityDecision.reason,
            message: profanityDecision.reason,
            matchedTerms: profanityDecision.matchedTerms,
            normalizedContent: profanityDecision.normalizedContent,
            warningCount: moderationOutcome.warningCount,
            violationCount: moderationOutcome.violationCount,
            muteApplied: moderationOutcome.muteApplied,
            mutedUntil: moderationOutcome.mutedUntil,
          });
        }

        // AI Analysis
        let aiAnalysis = { approved: true, status: 'approved' };
        if (room.settings?.aiModerationEnabled) {
          aiAnalysis = await analyzeMessage(content, roomId, socket.userId);
        }

        if (aiAnalysis.pendingReview) {
          const moderationOutcome = await moderationService.recordModerationDecision({
            room,
            user: socket.user,
            content: content.trim(),
            normalizedContent: profanityDecision.normalizedContent,
            matchedTerms: profanityDecision.matchedTerms,
            severity: aiAnalysis.severity || 'high',
            action: 'manual-review',
            source: 'ai',
            reason: aiAnalysis.reason || 'Message queued for review by AI moderator.',
            filterEngine: 'ai-moderator',
            countWarning: false,
            aiScores: {
              toxicity: aiAnalysis.toxicityScore || 0,
              fallacyConfidence: aiAnalysis.fallacies?.length ? 0.7 : 0,
            },
            factCheckResults: aiAnalysis.factCheck || null,
          });

          return socket.emit('message:blocked', {
            blocked: true,
            pendingReview: true,
            status: 'pending_review',
            reason: aiAnalysis.reason || 'Message queued for review by AI moderator.',
            message: aiAnalysis.reason || 'Message queued for review by AI moderator.',
            warningCount: moderationOutcome.warningCount,
            muteApplied: moderationOutcome.muteApplied,
            mutedUntil: moderationOutcome.mutedUntil,
          });
        }

        if (aiAnalysis.approved === false) {
          const moderationOutcome = await moderationService.recordModerationDecision({
            room,
            user: socket.user,
            content: content.trim(),
            normalizedContent: profanityDecision.normalizedContent,
            matchedTerms: profanityDecision.matchedTerms,
            severity: aiAnalysis.severity || 'high',
            action: 'message-blocked',
            source: 'ai',
            reason: aiAnalysis.reason || 'Message blocked by AI moderator.',
            filterEngine: 'ai-moderator',
            aiScores: {
              toxicity: aiAnalysis.toxicityScore || 0,
              fallacyConfidence: aiAnalysis.fallacies?.length ? 0.7 : 0,
            },
            factCheckResults: aiAnalysis.factCheck || null,
          });

          return socket.emit('message:blocked', {
            blocked: true,
            reason: aiAnalysis.reason || 'Message blocked by AI moderator.',
            message: aiAnalysis.reason || 'Message blocked by AI moderator.',
            warningCount: moderationOutcome.warningCount,
            muteApplied: moderationOutcome.muteApplied,
            mutedUntil: moderationOutcome.mutedUntil,
          });
        }

        // Create message only after moderation allows it
        const message = new Message({
          room: room._id,
          sender: socket.userId,
          content: content.trim(),
          type,
          moderation: {
            analyzed: true,
            analyzedAt: new Date(),
            toxicity: {
              score: aiAnalysis.toxicityScore || 0,
              flagged: aiAnalysis.isToxic || false
            },
            fallacy: {
              detected: aiAnalysis.hasFallacy || false,
              types: aiAnalysis.fallacies || []
            }
          },
          status: 'approved'
        });

        await message.save();

        // Update user stats
        socket.user.stats.messagesSent++;
        await socket.user.save();

        // Populate sender info
        await message.populate('sender', 'username profile.avatar');

        const messageData = {
          id: message._id,
          _id: message._id,
          content: message.content,
          type: message.type,
          sender: {
            id: message.sender._id,
            _id: message.sender._id,
            username: message.sender.username,
            avatar: message.sender.profile?.avatar
          },
          createdAt: message.createdAt,
          moderation: message.moderation,
          status: message.status
        };

        // Handle AI warnings
        if (aiAnalysis.isToxic || aiAnalysis.hasFallacy) {
          socket.emit('ai:warning', {
            type: aiAnalysis.isToxic ? 'toxicity' : 'fallacy',
            details: aiAnalysis.details || {},
            toxicityScore: aiAnalysis.toxicityScore,
            fallacies: aiAnalysis.fallacies,
            suggestions: aiAnalysis.suggestions
          });

          // Update warning count if toxic
          if (aiAnalysis.isToxic) {
            socket.user.stats.warningsReceived++;
            await socket.user.save();
          }
        }

        // Broadcast to room only after all moderation passes
        io.to(roomId).emit('message:received', messageData);

        // Handle fact-check results
        if (aiAnalysis.factCheck && aiAnalysis.factCheck.needsVerification) {
          io.to(roomId).emit('ai:fact-check', {
            messageId: message._id,
            claim: aiAnalysis.factCheck.claim,
            verdict: aiAnalysis.factCheck.verdict,
            confidence: aiAnalysis.factCheck.confidence,
            sources: aiAnalysis.factCheck.sources
          });
        }

      } catch (error) {
        console.error('Message send error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    /**
     * Typing indicator
     */
    socket.on('typing:start', (data) => {
      const { roomId } = data;
      socket.to(roomId).emit('typing:update', {
        userId: socket.userId,
        username: socket.user.username,
        isTyping: true
      });
    });

    socket.on('typing:stop', (data) => {
      const { roomId } = data;
      socket.to(roomId).emit('typing:update', {
        userId: socket.userId,
        username: socket.user.username,
        isTyping: false
      });
    });

    /**
     * Leave room
     */
    socket.on('room:leave', (data) => {
      const { roomId } = data;
      socket.leave(roomId);

      const userData = connectedUsers.get(socket.userId);
      if (userData) {
        userData.currentRoom = null;
        connectedUsers.set(socket.userId, userData);
      }

      const currentRoomUsers = roomUsers.get(roomId) || new Set();
      currentRoomUsers.delete(socket.userId);
      roomUsers.set(roomId, currentRoomUsers);

      if (currentRoomUsers.size === 0) {
        lastMessageState.delete(roomId);
      }

      socket.to(roomId).emit('room:user-left', {
        userId: socket.userId,
        username: socket.user.username
      });

      console.log(`👋 ${socket.user.username} left room: ${roomId}`);
    });

    /**
     * Message reactions
     */
    socket.on('message:react', async (data) => {
      try {
        const { messageId, reaction } = data;
        const message = await Message.findById(messageId);

        if (!message) {
          return socket.emit('error', { message: 'Message not found' });
        }

        // Add or remove reaction
        const existingReaction = message.reactions.find(
          r => r.user.toString() === socket.userId && r.type === reaction
        );

        if (existingReaction) {
          message.reactions = message.reactions.filter(
            r => !(r.user.toString() === socket.userId && r.type === reaction)
          );
        } else {
          message.reactions.push({ user: socket.userId, type: reaction });
        }

        await message.save();

        const room = await Room.findById(message.room);
        io.to(room.roomId).emit('message:reaction-update', {
          messageId,
          reactions: message.reactions
        });
      } catch (error) {
        console.error('Reaction error:', error);
      }
    });

    /**
     * Disconnect
     */
    socket.on('disconnect', async () => {
      console.log(`❌ User disconnected: ${socket.user.username}`);

      const userData = connectedUsers.get(socket.userId);
      
      // Remove from current room
      if (userData?.currentRoom) {
        const roomUserSet = roomUsers.get(userData.currentRoom) || new Set();
        roomUserSet.delete(socket.userId);
        roomUsers.set(userData.currentRoom, roomUserSet);

        if (roomUserSet.size === 0) {
          lastMessageState.delete(userData.currentRoom);
        }

        socket.to(userData.currentRoom).emit('room:user-left', {
          userId: socket.userId,
          username: socket.user.username
        });
      }

      // Remove from connected users
      connectedUsers.delete(socket.userId);
      messageRateState.delete(socket.userId);

      // Broadcast offline status
      io.emit('user:offline', {
        userId: socket.userId,
        username: socket.user.username
      });

      // Update last active
      socket.user.lastActive = new Date();
      await socket.user.save();
    });
  });
};

module.exports = { initializeSocket, connectedUsers, roomUsers };

module.exports.checkConnectionRateLimit = checkConnectionRateLimit;
module.exports.checkMessageRateLimit = checkMessageRateLimit;
module.exports.checkSlowMode = checkSlowMode;
