const crypto = require('crypto');
const Room = require('../models/Room');
const Message = require('../models/Message');
const SpeakerRequest = require('../models/SpeakerRequest');
const Notification = require('../models/Notification');
const RoomActivity = require('../models/RoomActivity');

const REACTION_TYPES = ['agree', 'love', 'fire', 'laugh', 'clap', 'disagree'];

const rolePriority = {
  viewer: 0,
  participant: 1,
  moderator: 2,
  owner: 3,
};

const getNormalizedRole = (room, userId) => {
  if (!room || !userId) {
    return 'viewer';
  }
  return room.getMemberRole(userId);
};

const canSendMessage = (room, userId) => ['owner', 'moderator', 'participant'].includes(getNormalizedRole(room, userId));
const canReact = (room, userId) => ['owner', 'moderator', 'participant', 'viewer'].includes(getNormalizedRole(room, userId));
const canModerate = (room, userId) => ['owner', 'moderator'].includes(getNormalizedRole(room, userId));
const canApproveSpeaker = (room, userId) => room?.host?.toString() === userId.toString();

const buildRoomState = async ({ room, userId, onlineUsers = [], typingUsers = [], pendingSpeakerRequests = [] }) => {
  const populatedRoom = room.populate
    ? await room.populate([
        { path: 'host', select: 'username profile.avatar' },
        { path: 'moderators', select: 'username profile.avatar' },
        { path: 'participants.user', select: 'username profile.avatar' },
      ])
    : room;

  const messages = await Message.find(Message.visibleQuery(room._id))
    .populate('sender', 'username profile.avatar')
    .populate('replyTo', 'content sender')
    .sort({ createdAt: 1 })
    .limit(200);

  const speakerRequests = pendingSpeakerRequests.length
    ? pendingSpeakerRequests
    : await SpeakerRequest.getPendingForRoom(room._id);

  // Normalize participants and dedupe by id to guard against accidental duplicates
  const rawParticipants = populatedRoom.participants.map((participant) => ({
    id: participant.user?._id?.toString?.() || participant.user?.toString?.(),
    username: participant.user?.username,
    avatar: participant.user?.profile?.avatar || null,
    role: participant.role || 'viewer',
    isMuted: Boolean(participant.isMuted),
    mutedUntil: participant.mutedUntil || null,
    muteReason: participant.muteReason || null,
    violationCount: participant.violationCount || 0,
    isOnline: Boolean(participant.isOnline),
    lastSeenAt: participant.lastSeenAt || null,
    joinedAt: participant.joinedAt,
  }));

  const participantsMap = new Map();
  rawParticipants.forEach((p) => {
    if (!p || !p.id) return;
    const current = participantsMap.get(p.id);
    if (!current) {
      participantsMap.set(p.id, p);
      return;
    }

    const currentRole = current.role || 'viewer';
    const incomingRole = p.role || 'viewer';
    if (rolePriority[incomingRole] >= rolePriority[currentRole]) {
      participantsMap.set(p.id, { ...current, ...p, role: incomingRole });
    }
  });
  const participants = Array.from(participantsMap.values());

  return {
    room: {
      id: populatedRoom._id,
      roomId: populatedRoom.roomId,
      name: populatedRoom.name,
      description: populatedRoom.description,
      topic: populatedRoom.topic,
      category: populatedRoom.category,
      privacy: populatedRoom.privacy,
      status: populatedRoom.status,
      host: populatedRoom.host,
      moderators: populatedRoom.moderators,
      settings: populatedRoom.settings,
      stats: populatedRoom.stats,
      participantCount: populatedRoom.participantCount,
      onlineCount: onlineUsers.length,
      role: getNormalizedRole(populatedRoom, userId),
      canSendMessage: canSendMessage(populatedRoom, userId),
      canReact: canReact(populatedRoom, userId),
      canModerate: canModerate(populatedRoom, userId),
      canRequestSpeaker: getNormalizedRole(populatedRoom, userId) === 'viewer',
    },
    messages: messages.map((message) => ({
      id: message._id,
      _id: message._id,
      content: message.content,
      replyTo: message.replyTo,
      type: message.type,
      status: message.status,
      sender: message.sender,
      reactions: message.reactions,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      isEdited: message.isEdited,
      moderation: message.moderation,
    })),
    participants,
    // Ensure onlineUsers and typingUsers are unique by id as well
    onlineUsers: Array.isArray(onlineUsers)
      ? Array.from(new Map(onlineUsers.filter(Boolean).map((u) => [u.id || u.userId || u._id || u?.user?._id, u])).values())
      : [],
    typingUsers: Array.isArray(typingUsers)
      ? Array.from(new Map(typingUsers.filter(Boolean).map((t) => [t.userId || t.id, t])).values())
      : [],
    speakerRequests: speakerRequests.map((request) => ({
      id: request._id,
      user: request.user,
      message: request.message,
      status: request.status,
      createdAt: request.createdAt,
    })),
  };
};

const ensureNotification = async ({ recipient, room, actor, type, title, body, data = {} }) => Notification.create({
  recipient,
  room,
  actor,
  type,
  title,
  body,
  data,
});

const recordActivity = async ({ room, actor, target = null, type, payload = {} }) => RoomActivity.create({ room, actor, target, type, payload });

const createClientMessageId = () => crypto.randomUUID();

module.exports = {
  REACTION_TYPES,
  getNormalizedRole,
  canSendMessage,
  canReact,
  canModerate,
  canApproveSpeaker,
  buildRoomState,
  ensureNotification,
  recordActivity,
  createClientMessageId,
};
