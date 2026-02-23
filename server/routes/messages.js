/**
 * Message Routes
 * Message history, search, and management
 */

const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Room = require('../models/Room');
const ModerationLog = require('../models/ModerationLog');
const moderationService = require('../services/moderationService');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

/**
 * @route   GET /api/messages/:roomId
 * @desc    Get messages for a room with pagination
 * @access  Private
 */
router.get('/:roomId', asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;

  const room = await Room.findOne({ roomId });
  if (!room) {
    throw new AppError('Room not found', 404);
  }

  // Check access
  const isParticipant = room.participants.some(
    p => p.user.toString() === req.userId.toString()
  );
  const isModerator = room.moderators.some(
    m => m.toString() === req.userId.toString()
  );
  const isHost = room.host.toString() === req.userId.toString();

  if (!isParticipant && !isModerator && !isHost && room.privacy === 'private') {
    throw new AppError('Not authorized to view messages', 403);
  }

  const visibleQuery = Message.visibleQuery(room._id);

  const [messages, total] = await Promise.all([
    Message.find(visibleQuery)
      .populate('sender', 'username profile.avatar')
      .populate('replyTo', 'content sender')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Message.countDocuments(visibleQuery)
  ]);

  res.json({
    messages: messages.reverse(),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasMore: skip + messages.length < total
    }
  });
}));

/**
 * @route   GET /api/messages/:roomId/search
 * @desc    Search messages in a room
 * @access  Private
 */
router.get('/:roomId/search', asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { query, startDate, endDate } = req.query;

  const room = await Room.findOne({ roomId });
  if (!room) {
    throw new AppError('Room not found', 404);
  }

  const searchQuery = Message.visibleQuery(room._id);

  if (query) {
    searchQuery.$text = { $search: query };
  }

  if (startDate || endDate) {
    searchQuery.createdAt = {};
    if (startDate) searchQuery.createdAt.$gte = new Date(startDate);
    if (endDate) searchQuery.createdAt.$lte = new Date(endDate);
  }

  const messages = await Message.find(searchQuery)
    .populate('sender', 'username profile.avatar')
    .sort({ createdAt: -1 })
    .limit(100);

  res.json({ messages });
}));

/**
 * @route   GET /api/messages/:roomId/flagged
 * @desc    Get flagged messages in a room (moderators only)
 * @access  Private
 */
router.get('/:roomId/flagged', asyncHandler(async (req, res) => {
  const { roomId } = req.params;

  const room = await Room.findOne({ roomId });
  if (!room) {
    throw new AppError('Room not found', 404);
  }

  const isModerator = room.moderators.some(m => m.toString() === req.userId.toString());
  if (!isModerator && room.host.toString() !== req.userId.toString()) {
    throw new AppError('Not authorized', 403);
  }

  const messages = await Message.find({
    room: room._id,
    'moderation.toxicity.flagged': true
  })
    .populate('sender', 'username profile.avatar')
    .sort({ createdAt: -1 });

  res.json({ messages });
}));

/**
 * @route   DELETE /api/messages/:messageId
 * @desc    Delete a message (soft delete)
 * @access  Private
 */
router.delete('/:messageId', asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.messageId);

  if (!message) {
    throw new AppError('Message not found', 404);
  }

  const room = await Room.findById(message.room);
  const isOwner = message.sender.toString() === req.userId;
  const isModerator = room.moderators.some(m => m.toString() === req.userId);
  const isHost = room.host.toString() === req.userId;

  if (!isOwner && !isModerator && !isHost) {
    throw new AppError('Not authorized to delete this message', 403);
  }

  message.isDeleted = true;
  message.deletedAt = new Date();
  message.deletedBy = req.userId;
  await message.save();

  res.json({ message: 'Message deleted successfully' });
}));

/**
 * @route   PUT /api/messages/:messageId
 * @desc    Edit a message
 * @access  Private
 */
router.put('/:messageId', asyncHandler(async (req, res) => {
  const { content } = req.body;

  if (!content || content.trim().length === 0) {
    throw new AppError('Message content is required', 400);
  }

  const message = await Message.findById(req.params.messageId);

  if (!message) {
    throw new AppError('Message not found', 404);
  }

  if (message.sender.toString() !== req.userId) {
    throw new AppError('Not authorized to edit this message', 403);
  }

  // Check if within edit time limit (5 minutes)
  const editLimit = 5 * 60 * 1000;
  if (Date.now() - message.createdAt > editLimit) {
    throw new AppError('Edit time limit exceeded', 400);
  }

  const room = await Room.findById(message.room);
  if (!room) {
    throw new AppError('Room not found', 404);
  }

  const moderationDecision = moderationService.detectProfanity(content);

  if (moderationDecision.blocked) {
    await moderationService.recordModerationDecision({
      room,
      user: req.user,
      content: content.trim(),
      normalizedContent: moderationDecision.normalizedContent,
      matchedTerms: moderationDecision.matchedTerms,
      severity: moderationDecision.severity,
      action: 'message-modified',
      source: 'system',
      reason: 'Edited message blocked due to inappropriate language.',
      filterEngine: moderationDecision.filterEngine,
    });

    throw new AppError('Message blocked due to inappropriate language.', 400);
  }

  if (room.settings?.aiModerationEnabled) {
    const aiAnalysis = await moderationService.runAiModeration({
      content: content.trim(),
      roomId: room.roomId,
      userId: req.userId,
    });

    if (aiAnalysis.pendingReview) {
      await ModerationLog.create({
        targetUser: req.userId,
        room: room._id,
        message: message._id,
        action: 'manual-review',
        severity: 'high',
        source: 'ai',
        details: {
          originalContent: content.trim(),
          normalizedContent: moderationDecision.normalizedContent,
          matchedTerms: moderationDecision.matchedTerms,
          filterEngine: 'ai-moderator',
          blockedReason: aiAnalysis.reason,
          reason: aiAnalysis.reason,
        },
      });

      return res.status(202).json({
        message: 'Edit queued for moderation review',
        status: 'pending_review',
        moderation: aiAnalysis,
      });
    }

    if (aiAnalysis.approved === false) {
      await moderationService.recordModerationDecision({
        room,
        user: req.user,
        content: content.trim(),
        normalizedContent: moderationDecision.normalizedContent,
        matchedTerms: moderationDecision.matchedTerms,
        severity: aiAnalysis.severity || 'high',
        action: 'message-modified',
        source: 'ai',
        reason: aiAnalysis.reason || 'Edited message blocked by AI moderator.',
        filterEngine: 'ai-moderator',
        aiScores: {
          toxicity: aiAnalysis.toxicityScore || 0,
          fallacyConfidence: aiAnalysis.fallacies?.length ? 0.7 : 0,
        },
      });

      throw new AppError(aiAnalysis.reason || 'Edited message blocked by AI moderator.', 400);
    }
  }

  // Save edit history only after moderation passes
  message.editHistory.push({
    content: message.content,
    editedAt: new Date()
  });

  message.content = content.trim();
  message.isEdited = true;
  await message.save();

  await message.populate('sender', 'username profile.avatar');

  res.json({ message });
}));

module.exports = router;
