import { create } from 'zustand';
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

export const useSocketStore = create((set, get) => ({
  socket: null,
  isConnected: false,
  currentRoom: null,
  onlineUsers: [],
  typingUsers: [],
  messages: [],
  
  connect: (token) => {
    const existingSocket = get().socket;
    if (existingSocket) return;
    
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    socket.on('connect', () => {
      console.log('Socket connected');
      set({ isConnected: true });
    });
    
    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      set({ isConnected: false });
    });
    
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
    
    socket.on('room:joined', (data) => {
      set({
        currentRoom: data.room,
        messages: data.messages,
        onlineUsers: data.room.onlineUsers || [],
      });
    });
    
    socket.on('room:user-joined', (user) => {
      set((state) => ({
        onlineUsers: [...state.onlineUsers.filter(u => u.id !== user.userId), {
          id: user.userId,
          username: user.username,
          avatar: user.avatar,
        }],
      }));
    });
    
    socket.on('room:user-left', (user) => {
      set((state) => ({
        onlineUsers: state.onlineUsers.filter(u => u.id !== user.userId),
      }));
    });
    
    socket.on('message:received', (message) => {
      set((state) => ({
        messages: [...state.messages, message],
      }));
    });

    socket.on('message:blocked', (data) => {
      const event = new CustomEvent('ai-warning', {
        detail: {
          type: 'toxicity',
          message: data.reason || 'Message blocked due to inappropriate language.',
          suggestions: ['Please remove abusive language and try again.'],
          toxicityScore: 1,
          blocked: true,
          matchedTerms: data.matchedTerms || [],
        },
      });
      window.dispatchEvent(event);
    });
    
    socket.on('message:flagged', (data) => {
      if (data?.blocked) {
        const event = new CustomEvent('ai-warning', {
          detail: {
            type: 'toxicity',
            message: data.reason || 'Message blocked due to inappropriate language.',
            suggestions: data.suggestions || ['Please rephrase your message respectfully.'],
            toxicityScore: 1,
            blocked: true,
          },
        });
        window.dispatchEvent(event);
        return;
      }

      set((state) => ({
        messages: [...state.messages, { ...data.message, isFlagged: true }],
      }));
    });
    
    socket.on('typing:update', (data) => {
      set((state) => {
        if (data.isTyping) {
          return {
            typingUsers: [...state.typingUsers.filter(u => u.id !== data.userId), {
              id: data.userId,
              username: data.username,
            }],
          };
        }
        return {
          typingUsers: state.typingUsers.filter(u => u.id !== data.userId),
        };
      });
    });
    
    socket.on('ai:warning', (data) => {
      // Handle AI warning - will be displayed via toast
      const event = new CustomEvent('ai-warning', { detail: data });
      window.dispatchEvent(event);
    });
    
    socket.on('ai:fact-check', (data) => {
      // Handle fact check result
      const event = new CustomEvent('ai-fact-check', { detail: data });
      window.dispatchEvent(event);
    });
    
    socket.on('message:reaction-update', (data) => {
      set((state) => ({
        messages: state.messages.map(m =>
          m.id === data.messageId ? { ...m, reactions: data.reactions } : m
        ),
      }));
    });
    
    socket.on('user:online', (user) => {
      set((state) => ({
        onlineUsers: [...state.onlineUsers.filter(u => u.id !== user.userId), {
          id: user.userId,
          username: user.username,
          avatar: user.avatar,
        }],
      }));
    });
    
    socket.on('user:offline', (user) => {
      set((state) => ({
        onlineUsers: state.onlineUsers.filter(u => u.id !== user.userId),
      }));
    });
    
    set({ socket });
  },
  
  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },
  
  joinRoom: (roomId) => {
    const { socket } = get();
    if (socket) {
      socket.emit('room:join', { roomId });
    }
  },
  
  leaveRoom: (roomId) => {
    const { socket } = get();
    if (socket) {
      socket.emit('room:leave', { roomId });
      set({ currentRoom: null, messages: [], onlineUsers: [], typingUsers: [] });
    }
  },
  
  sendMessage: (roomId, content, type = 'text') => {
    const { socket } = get();
    if (socket) {
      socket.emit('message:send', { roomId, content, type });
    }
  },
  
  startTyping: (roomId) => {
    const { socket } = get();
    if (socket) {
      socket.emit('typing:start', { roomId });
    }
  },
  
  stopTyping: (roomId) => {
    const { socket } = get();
    if (socket) {
      socket.emit('typing:stop', { roomId });
    }
  },
  
  setTyping: (roomId, isTyping) => {
    const { socket } = get();
    if (socket) {
      socket.emit(isTyping ? 'typing:start' : 'typing:stop', { roomId });
    }
  },
  
  addReaction: (messageId, reaction) => {
    const { socket } = get();
    if (socket) {
      socket.emit('message:react', { messageId, reaction });
    }
  },
  
  clearMessages: () => {
    set({ messages: [] });
  },
}));
