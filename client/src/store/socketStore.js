import { create } from 'zustand';
import { io } from 'socket.io-client';
import { useAuthStore } from './authStore';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

const mergeById = (messages) => {
  const map = new Map();
  messages.forEach((message) => {
    const key = message._id || message.id || message.clientMessageId;
    if (key) map.set(key, message);
  });
  return Array.from(map.values()).sort((left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0));
};

const dedupeById = (items = [], idKeyCandidates = ['id', '_id', 'userId']) => {
  const map = new Map();
  (items || []).forEach((it) => {
    if (!it) return;
    const key = idKeyCandidates.map((k) => it[k]).find(Boolean) || it.id || it._id;
    if (key) map.set(key.toString(), it);
  });
  return Array.from(map.values());
};

const rolePriority = {
  viewer: 0,
  participant: 1,
  moderator: 2,
  owner: 3,
};

const getComparableId = (value) => (value ? value.toString() : null);

const getParticipantId = (participant) => (
  participant?.user?.id
  || participant?.user?._id
  || participant?.userId
  || participant?.id
  || participant?._id
  || null
);

const dedupeParticipants = (participants = []) => {
  const map = new Map();

  participants.forEach((participant) => {
    if (!participant) return;
    const id = getComparableId(getParticipantId(participant));
    if (!id) return;

    const normalized = {
      ...participant,
      id: getComparableId(participant.id || id),
      _id: getComparableId(participant._id || id),
      userId: getComparableId(participant.userId || id),
    };

    const existing = map.get(id);
    if (!existing) {
      map.set(id, normalized);
      return;
    }

    const currentRole = existing.role || 'viewer';
    const incomingRole = normalized.role || 'viewer';
    map.set(id, {
      ...existing,
      ...normalized,
      role: rolePriority[incomingRole] > rolePriority[currentRole] ? incomingRole : currentRole,
    });
  });

  return Array.from(map.values());
};

const normalizeRoomState = (state = {}) => ({
  ...state,
  participants: dedupeParticipants(state.participants || []),
  onlineUsers: dedupeById(state.onlineUsers || []),
  typingUsers: dedupeById(state.typingUsers || [], ['userId', 'id', '_id']),
  messages: mergeById(state.messages || []),
  speakerRequests: state.speakerRequests || [],
});

const upsertMessage = (messages, incoming) => {
  const incomingId = incoming._id || incoming.id || incoming.clientMessageId;
  const next = messages.filter((message) => {
    const currentId = message._id || message.id || message.clientMessageId;
    return currentId !== incomingId && message.clientMessageId !== incoming.clientMessageId;
  });
  next.push(incoming);
  return mergeById(next);
};

const updateMessage = (messages, messageId, updater) => messages.map((message) => {
  const currentId = message._id || message.id || message.clientMessageId;
  return currentId === messageId ? updater(message) : message;
});

const removeMessage = (messages, messageId) => messages.filter((message) => {
  const currentId = message._id || message.id || message.clientMessageId;
  return currentId !== messageId;
});

const emitCustomEvent = (name, detail) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }
};

const emitWithAck = (socket, event, payload) => new Promise((resolve) => {
  socket.emit(event, payload, (response) => resolve(response || {}));
});

export const useSocketStore = create((set, get) => ({
  socket: null,
  isConnected: false,
  connectionStatus: 'disconnected',
  currentRoom: null,
  roomState: null,
  joinedRoomId: null,
  joinedSocketId: null,
  pendingJoinRoomId: null,
  participants: [],
  onlineUsers: [],
  typingUsers: [],
  messages: [],
  notifications: [],
  speakerRequests: [],
  pendingMessages: [],
  connect: (token) => {
    if (get().socket) {
      return get().socket;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 8000,
    });

    socket.on('connect', () => {
      console.debug('[socket] connect', socket.id);
      set({ isConnected: true, connectionStatus: 'connected' });
    });
    socket.on('disconnect', (reason) => {
      console.debug('[socket] disconnect', reason);
      set({ isConnected: false, connectionStatus: 'disconnected', joinedSocketId: null, pendingJoinRoomId: null });
    });
    socket.on('reconnect_attempt', (attempt) => {
      set({ connectionStatus: 'reconnecting' });
      console.debug('[socket] reconnect_attempt', attempt);
    });
    socket.on('reconnect', (attempt) => {
      console.debug('[socket] reconnect', attempt);
      set({ connectionStatus: 'connected', isConnected: true });
    });
    socket.on('reconnect_error', (error) => {
      console.warn('[socket] reconnect_error', error?.message);
      set({ connectionStatus: 'reconnecting' });
    });
    socket.on('connect_error', (error) => {
      console.warn('[socket] connect_error', error?.message);
      emitCustomEvent('socket-error', { message: error.message });
    });

    // Prevent duplicate listener registration if connect() somehow called multiple times
    if (socket.__listenersInitialized) {
      set({ socket });
      return socket;
    }
    socket.__listenersInitialized = true;

    socket.on('room:state', (state) => {
      console.debug('[socket] room:state', state.room?.roomId);
      const normalized = normalizeRoomState(state);
      set({
        roomState: normalized.room,
        currentRoom: normalized.room,
        joinedRoomId: normalized.room?.roomId || null,
        joinedSocketId: socket.id,
        pendingJoinRoomId: null,
        participants: normalized.participants,
        onlineUsers: normalized.onlineUsers,
        typingUsers: normalized.typingUsers,
        messages: normalized.messages,
        speakerRequests: normalized.speakerRequests,
      });
    });

    // 'room:joined' handled above together with 'room:state' to avoid duplicate updates

    socket.on('room:user_joined', (user) => {
      set((state) => ({
        onlineUsers: dedupeById([...(state.onlineUsers || []), {
          id: user.userId,
          _id: user.userId,
          username: user.username,
          avatar: user.avatar,
          role: user.role,
          lastSeenAt: new Date().toISOString(),
        }]),
      }));
    });

    socket.on('room:user_left', (user) => {
      set((state) => ({
        onlineUsers: (state.onlineUsers || []).filter((entry) => (entry._id || entry.id) !== user.userId),
        typingUsers: (state.typingUsers || []).filter((entry) => entry.userId !== user.userId),
      }));
    });

    socket.on('presence:update', (data) => {
      set({ onlineUsers: dedupeById(data.onlineUsers || []) });
    });

    socket.on('user:typing', (data) => {
      set((state) => {
        if (data.isTyping) {
          return { typingUsers: dedupeById([...(state.typingUsers || []), { userId: data.userId, username: data.username, isTyping: true }], ['userId']) };
        }
        return { typingUsers: (state.typingUsers || []).filter((entry) => entry.userId !== data.userId && entry.id !== data.userId) };
      });
    });

    socket.on('notification:new', (notification) => {
      set((state) => ({ notifications: [notification, ...state.notifications].slice(0, 100) }));
      emitCustomEvent('notification:new', notification);
    });

    socket.on('moderation:warning', (warning) => emitCustomEvent('ai-warning', warning));
    socket.on('message:blocked', (data) => emitCustomEvent('ai-warning', {
      type: 'toxicity',
      message: data.reason || 'Message blocked due to inappropriate language.',
      suggestions: ['Please rephrase your message respectfully.'],
      blocked: true,
      ...data,
    }));

    socket.on('speaker:approved', (payload) => emitCustomEvent('speaker:approved', payload));
    socket.on('speaker:rejected', (payload) => emitCustomEvent('speaker:rejected', payload));
    socket.on('message:new', (message) => {
      set((state) => ({
        messages: upsertMessage(
          state.messages.filter((entry) => entry.clientMessageId !== message.clientMessageId),
          message,
        ),
        pendingMessages: state.pendingMessages.filter((entry) => entry.clientMessageId !== message.clientMessageId),
      }));
    });

    socket.on('message:updated', (message) => {
      set((state) => ({ messages: upsertMessage(updateMessage(state.messages, message.id || message._id, () => message), message) }));
    });

    socket.on('message:deleted', (payload) => {
      set((state) => ({ messages: removeMessage(state.messages, payload.messageId) }));
    });

    socket.on('message:reaction_updated', (payload) => {
      set((state) => ({
        messages: state.messages.map((message) => {
          const currentId = message._id || message.id;
          if (currentId !== payload.messageId) return message;
          return {
            ...message,
            reactions: payload.reactions,
            reactionCounts: payload.counts,
          };
        }),
      }));
    });

    socket.on('user:muted', (payload) => emitCustomEvent('user:muted', payload));
    socket.on('room:participant_updated', (payload) => {
      const currentUserId = useAuthStore.getState().user?._id?.toString?.();
      set((state) => ({
        participants: dedupeParticipants(state.participants.map((participant) => (
          (participant.id || participant.userId)?.toString?.() === payload.userId?.toString?.()
            ? { ...participant, role: payload.role }
            : participant
        ))),
        roomState: state.roomState && currentUserId && currentUserId === payload.userId?.toString?.()
          ? {
            ...state.roomState,
            role: payload.role,
            canSendMessage: ['owner', 'moderator', 'participant'].includes(payload.role),
            canReact: true,
            canModerate: ['owner', 'moderator'].includes(payload.role),
            canRequestSpeaker: payload.role === 'viewer',
          }
          : state.roomState,
      }));
    });

    socket.on('room:joined', (state) => {
      console.debug('[socket] room:joined', state.room?.roomId);
      const normalized = normalizeRoomState(state);
      set({
        roomState: normalized.room,
        currentRoom: normalized.room,
        joinedRoomId: normalized.room?.roomId || null,
        joinedSocketId: socket.id,
        pendingJoinRoomId: null,
        participants: normalized.participants,
        onlineUsers: normalized.onlineUsers,
        typingUsers: normalized.typingUsers,
        messages: normalized.messages,
        speakerRequests: normalized.speakerRequests,
      });
    });

    set({ socket });
    return socket;
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }
    set({
      socket: null,
      isConnected: false,
      connectionStatus: 'disconnected',
      currentRoom: null,
      roomState: null,
      joinedRoomId: null,
      joinedSocketId: null,
      pendingJoinRoomId: null,
      participants: [],
      onlineUsers: [],
      typingUsers: [],
      messages: [],
      notifications: [],
      speakerRequests: [],
      pendingMessages: [],
    });
  },

  joinRoom: async (roomId) => {
    const { socket } = get();
    if (!socket) return { ok: false, error: 'Socket not connected' };
    const current = get();
    if (current.joinedRoomId === roomId && current.joinedSocketId === socket.id) {
      console.debug('[socket] duplicate join prevented', roomId, socket.id);
      return { ok: true, duplicate: true, roomId };
    }
    if (current.pendingJoinRoomId === roomId) {
      console.debug('[socket] pending join prevented', roomId, socket.id);
      return { ok: true, duplicate: true, roomId };
    }
    set({ pendingJoinRoomId: roomId });
    const response = await emitWithAck(socket, 'room:join', { roomId });
    if (get().pendingJoinRoomId === roomId) {
      set({ pendingJoinRoomId: null });
    }
    return response;
  },

  leaveRoom: async (roomId) => {
    const { socket } = get();
    if (!socket) return { ok: false, error: 'Socket not connected' };
    const response = await emitWithAck(socket, 'room:leave', { roomId });
    set({ currentRoom: null, roomState: null, joinedRoomId: null, joinedSocketId: null, pendingJoinRoomId: null, participants: [], onlineUsers: [], typingUsers: [], messages: [], speakerRequests: [], pendingMessages: [] });
    return response;
  },

  requestSpeakerAccess: async (roomId, message = '') => {
    const { socket } = get();
    if (!socket) return { ok: false, error: 'Socket not connected' };
    return emitWithAck(socket, 'speaker:request', { roomId, message });
  },

  approveSpeakerRequest: async (roomId, requestId, note = '') => {
    const { socket } = get();
    if (!socket) return { ok: false, error: 'Socket not connected' };
    return emitWithAck(socket, 'speaker:approve', { roomId, requestId, note });
  },

  rejectSpeakerRequest: async (roomId, requestId, note = '') => {
    const { socket } = get();
    if (!socket) return { ok: false, error: 'Socket not connected' };
    return emitWithAck(socket, 'speaker:reject', { roomId, requestId, note });
  },

  sendMessage: async (roomId, content, options = {}) => {
    const { socket } = get();
    if (!socket) return { ok: false, error: 'Socket not connected' };
    const clientMessageId = options.clientMessageId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
    const optimisticMessage = {
      _id: clientMessageId,
      id: clientMessageId,
      clientMessageId,
      content,
      type: options.type || 'text',
      sender: options.sender || null,
      createdAt: new Date().toISOString(),
      status: 'pending',
      pending: true,
      replyTo: options.replyTo || null,
      reactions: [],
    };

    set((state) => ({
      messages: upsertMessage(state.messages, optimisticMessage),
      pendingMessages: upsertMessage(state.pendingMessages, optimisticMessage),
    }));

    const response = await emitWithAck(socket, 'message:send', {
      roomId,
      content,
      type: options.type || 'text',
      replyTo: options.replyTo,
      clientMessageId,
    });

    if (!response.ok) {
      set((state) => ({
        messages: removeMessage(state.messages, clientMessageId),
        pendingMessages: removeMessage(state.pendingMessages, clientMessageId),
      }));
    }

    return { ...response, clientMessageId };
  },

  editMessage: async (messageId, content, roomId, reason = 'edited') => {
    const { socket } = get();
    if (!socket) return { ok: false, error: 'Socket not connected' };
    return emitWithAck(socket, 'message:edit', { messageId, content, roomId, reason });
  },

  deleteMessage: async (messageId, roomId) => {
    const { socket } = get();
    if (!socket) return { ok: false, error: 'Socket not connected' };
    return emitWithAck(socket, 'message:delete', { messageId, roomId });
  },

  reactToMessage: async (messageId, reaction, roomId) => {
    const { socket } = get();
    if (!socket) return { ok: false, error: 'Socket not connected' };
    return emitWithAck(socket, 'message:react', { messageId, reaction, roomId });
  },

  startTyping: (roomId) => {
    const { socket } = get();
    if (socket) socket.emit('user:typing', { roomId, isTyping: true });
  },

  stopTyping: (roomId) => {
    const { socket } = get();
    if (socket) socket.emit('user:typing', { roomId, isTyping: false });
  },

  setTyping: (roomId, isTyping) => {
    const { socket } = get();
    if (socket) socket.emit('user:typing', { roomId, isTyping: Boolean(isTyping) });
  },

  assignModerator: async (roomId, userId) => {
    const { socket } = get();
    if (!socket) return { ok: false, error: 'Socket not connected' };
    return emitWithAck(socket, 'moderator:assign', { roomId, userId });
  },

  removeModerator: async (roomId, userId) => {
    const { socket } = get();
    if (!socket) return { ok: false, error: 'Socket not connected' };
    return emitWithAck(socket, 'moderator:remove', { roomId, userId });
  },

  muteUser: async (roomId, userId, minutes = 15, reason = '') => {
    const { socket } = get();
    if (!socket) return { ok: false, error: 'Socket not connected' };
    return emitWithAck(socket, 'user:mute', { roomId, userId, minutes, reason });
  },

  clearMessages: () => set({ messages: [] }),
}));
