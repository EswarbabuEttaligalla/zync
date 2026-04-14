/**
 * Centralized in-memory Room and Session manager for Socket connections.
 * Ensures deduplication by userId and socketId, supports multi-tab, and
 * provides helpers for presence and typing state.
 */
const debug = (...args) => console.debug('[RoomManager]', ...args);

const connectedUsers = new Map(); // userId -> { sockets: Map(socketId -> { socket, connectedAt }), lastSeenAt }
const roomMembers = new Map(); // roomId -> Map(userId -> Set(socketId))
const roomTyping = new Map(); // roomId -> Map(userId -> { userId, username, isTyping, since })

const toKey = (id) => id?.toString?.() || id;

const getUserSessions = (userId) => connectedUsers.get(toKey(userId)) || { sockets: new Map(), lastSeenAt: null };

const setUserSession = (userId, socket) => {
  const key = toKey(userId);
  const existing = connectedUsers.get(key) || { sockets: new Map(), lastSeenAt: null };
  existing.sockets.set(socket.id, { socket, connectedAt: new Date() });
  existing.lastSeenAt = new Date();
  connectedUsers.set(key, existing);
  debug('setUserSession', key, 'socket', socket.id, 'count', existing.sockets.size);
};

const removeUserSession = (userId, socketId) => {
  const key = toKey(userId);
  const existing = connectedUsers.get(key);
  if (!existing) return false;
  existing.sockets.delete(socketId);
  existing.lastSeenAt = new Date();
  if (existing.sockets.size === 0) {
    connectedUsers.delete(key);
    debug('removeUserSession: removed user', key);
    return true;
  }
  connectedUsers.set(key, existing);
  debug('removeUserSession: remaining sockets', key, existing.sockets.size);
  return false;
};

const emitToUser = (io, userId, event, payload) => {
  const sessions = connectedUsers.get(toKey(userId));
  if (!sessions) return;
  sessions.sockets.forEach(({ socket }) => {
    try { socket.emit(event, payload); } catch (e) {}
  });
};

const addRoomMember = (roomId, userId, socketId) => {
  const rkey = toKey(roomId);
  const ukey = toKey(userId);
  const members = roomMembers.get(rkey) || new Map();
  const sockets = members.get(ukey) || new Set();
  sockets.add(socketId);
  members.set(ukey, sockets);
  roomMembers.set(rkey, members);
  debug('addRoomMember', rkey, ukey, 'sockets', sockets.size);
  return members;
};

const removeRoomMember = (roomId, userId, socketId) => {
  const rkey = toKey(roomId);
  const ukey = toKey(userId);
  const members = roomMembers.get(rkey) || new Map();
  const sockets = members.get(ukey);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) members.delete(ukey);
    else members.set(ukey, sockets);
  }
  if (members.size === 0) {
    roomMembers.delete(rkey);
    roomTyping.delete(rkey);
  } else {
    roomMembers.set(rkey, members);
  }
  debug('removeRoomMember', rkey, ukey, 'remaining', members.size);
  return members;
};

const getRoomOnlineUsers = (roomId) => {
  const rkey = toKey(roomId);
  const members = Array.from((roomMembers.get(rkey) || new Map()).keys());
  return members.map((userId) => {
    const sessions = connectedUsers.get(userId);
    const firstSocket = sessions?.sockets?.values?.().next?.()?.value?.socket;
    const user = firstSocket?.user;
    if (!user) return null;
    return {
      id: userId,
      username: user.username,
      avatar: user.profile?.avatar || null,
      lastSeenAt: sessions?.lastSeenAt,
    };
  }).filter(Boolean);
};

const getRoomTypingUsers = (roomId) => {
  const rkey = toKey(roomId);
  return Array.from((roomTyping.get(rkey) || new Map()).values());
};

const setTyping = (roomId, userId, username, isTyping) => {
  const rkey = toKey(roomId);
  const map = roomTyping.get(rkey) || new Map();
  if (isTyping) {
    map.set(toKey(userId), { userId: toKey(userId), username, isTyping: true, since: new Date() });
  } else {
    map.delete(toKey(userId));
  }
  if (map.size === 0) roomTyping.delete(rkey); else roomTyping.set(rkey, map);
};

const emitPresenceUpdate = (io, roomId) => {
  const onlineUsers = getRoomOnlineUsers(roomId);
  io.to(roomId.toString()).emit('presence:update', { roomId: roomId.toString(), onlineUsers, onlineCount: onlineUsers.length });
};

module.exports = {
  getUserSessions,
  setUserSession,
  removeUserSession,
  emitToUser,
  addRoomMember,
  removeRoomMember,
  getRoomOnlineUsers,
  getRoomTypingUsers,
  setTyping,
  emitPresenceUpdate,
  // exposed for debugging/tests
  __internal: { connectedUsers, roomMembers, roomTyping },
};
