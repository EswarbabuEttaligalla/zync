import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Users,
  Settings,
  MoreVertical,
  Send,
  Smile,
  Paperclip,
  Info,
  Shield,
  Crown,
  Circle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  BellOff,
  Flag,
  LogOut,
  Copy,
  ExternalLink,
  Sparkles,
  Zap,
  Brain,
  Lock,
} from 'lucide-react';
import { Button, Badge, Card, Avatar, Spinner, cn } from '../components/ui';
import { ChatMessage, AIWarningToast } from '../components/Chat';
import { useAuthStore } from '../store/authStore';
import { useSocketStore } from '../store/socketStore';
import { roomAPI } from '../services/api';
import toast from 'react-hot-toast';

const RoomDetail = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { socket, isConnected, joinRoom, leaveRoom, sendMessage, setTyping } = useSocketStore();
  
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  
  const [message, setMessage] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [aiWarning, setAiWarning] = useState(null);

  // Fetch room data
  const { data: roomData, isLoading } = useQuery({
    queryKey: ['room', roomId],
    queryFn: async () => {
      const response = await roomAPI.getRoom(roomId);
      return response.data;
    },
  });
  
  const room = roomData?.room;

  // Initial messages fetch
  const { data: initialMessages } = useQuery({
    queryKey: ['messages', roomId],
    queryFn: async () => {
      const response = await roomAPI.getMessages(roomId, { limit: 50 });
      return response.data;
    },
    enabled: !!roomId,
  });

  // Join room on mount
  useEffect(() => {
    if (isConnected && roomId) {
      joinRoom(roomId);
    }

    return () => {
      if (isConnected && roomId) {
        leaveRoom(roomId);
      }
    };
  }, [isConnected, roomId, joinRoom, leaveRoom]);

  // Set initial messages
  useEffect(() => {
    if (initialMessages?.messages) {
      setMessages(initialMessages.messages);
    }
  }, [initialMessages]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => {
      setMessages(prev => [...prev, message]);
      
      if (message.moderation) {
        handleAIAnalysis(message.moderation, message);
      }
    };

    const handleUserTyping = (data) => {
      if (data.isTyping) {
        setTypingUsers(prev => [...prev.filter(u => u.id !== data.userId), { id: data.userId, username: data.username }]);
      } else {
        setTypingUsers(prev => prev.filter(u => u.id !== data.userId));
      }
    };

    const handleUserJoined = (user) => {
      setOnlineUsers(prev => [...prev.filter(u => u.id !== user.userId), {
        id: user.userId,
        username: user.username,
        avatar: user.avatar
      }]);
    };

    const handleUserLeft = (user) => {
      setOnlineUsers(prev => prev.filter(u => u.id !== user.userId));
    };

    const handleMessageFlagged = (data) => {
      if (data?.blocked) {
        setAiWarning({
          type: 'toxicity',
          message: data.reason || 'Message blocked due to inappropriate language.',
          suggestions: data.suggestions || ['Please rephrase your message respectfully.'],
          toxicityScore: 1,
        });

        window.setTimeout(() => setAiWarning(null), 5000);
        return;
      }

      setMessages(prev => [...prev, { ...data.message, isFlagged: true }]);
    };

    const handleMessageBlocked = (data) => {
      setAiWarning({
        type: 'toxicity',
        message: data.reason || 'Message blocked due to inappropriate language.',
        suggestions: data.suggestions || ['Please rephrase your message respectfully.'],
        toxicityScore: 1,
      });

      window.setTimeout(() => setAiWarning(null), 5000);
    };

    const handleRoomJoined = (data) => {
      setOnlineUsers(data.room.onlineUsers || []);
      if (data.messages) {
        setMessages(data.messages);
      }
    };

    socket.off('message:received', handleNewMessage);
    socket.off('typing:update', handleUserTyping);
    socket.off('room:user-joined', handleUserJoined);
    socket.off('room:user-left', handleUserLeft);
    socket.off('message:flagged', handleMessageFlagged);
    socket.off('message:blocked', handleMessageBlocked);
    socket.off('room:joined', handleRoomJoined);

    socket.on('message:received', handleNewMessage);
    socket.on('typing:update', handleUserTyping);
    socket.on('room:user-joined', handleUserJoined);
    socket.on('room:user-left', handleUserLeft);
    socket.on('message:flagged', handleMessageFlagged);
    socket.on('message:blocked', handleMessageBlocked);
    socket.on('room:joined', handleRoomJoined);

    return () => {
      socket.off('message:received', handleNewMessage);
      socket.off('typing:update', handleUserTyping);
      socket.off('room:user-joined', handleUserJoined);
      socket.off('room:user-left', handleUserLeft);
      socket.off('message:flagged', handleMessageFlagged);
      socket.off('message:blocked', handleMessageBlocked);
      socket.off('room:joined', handleRoomJoined);
    };
  }, [socket]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAIAnalysis = (moderation, message) => {
    if (moderation?.toxicity?.flagged) {
      setAiWarning({
        type: 'toxicity',
        severity: 'high',
        message: 'This message contains potentially harmful content',
      });
    } else if (moderation?.fallacy?.detected) {
      setAiWarning({
        type: 'fallacy',
        severity: 'warning',
        fallacies: moderation.fallacy.types,
        message: 'Logical fallacy detected in this argument',
      });
    }

    // Auto-dismiss warning
    setTimeout(() => setAiWarning(null), 5000);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    sendMessage(roomId, message.trim());
    setMessage('');
    setTyping(roomId, false);
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);
    setTyping(roomId, e.target.value.length > 0);
  };

  const handleLeaveRoom = async () => {
    try {
      await roomAPI.leaveRoom(roomId);
      navigate('/rooms');
      toast.success('Left the room');
    } catch (error) {
      toast.error('Failed to leave room');
    }
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Room link copied!');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)]">
        <h2 className="text-2xl font-bold text-white mb-2">Room not found</h2>
        <p className="text-dark-400 mb-4">This room may have been deleted or you don't have access.</p>
        <Button as={Link} to="/rooms">Browse Rooms</Button>
      </div>
    );
  }

  const isHost = room.host?._id === user?._id;
  const isModerator = room.moderators?.some(m => m._id === user?._id);

  return (
    <div className="flex h-[calc(100vh-6rem)] -m-6 bg-dark-950">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-800 bg-dark-900/50">
          <div className="flex items-center gap-4">
            <Link to="/rooms" className="p-2 hover:bg-dark-800 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-dark-400" />
            </Link>
            
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-white">{room.name}</h1>
                {room.isPrivate && <Lock className="w-4 h-4 text-dark-400" />}
                <Badge variant={room.status === 'active' ? 'success' : 'warning'} size="sm">
                  {room.status}
                </Badge>
              </div>
              <p className="text-sm text-dark-400">{room.category}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* AI Status Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-400">AI Active</span>
            </div>

            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                showSidebar ? 'bg-primary-500/20 text-primary-400' : 'hover:bg-dark-800 text-dark-400'
              )}
            >
              <Users className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="p-2 hover:bg-dark-800 rounded-lg text-dark-400 transition-colors"
            >
              <Info className="w-5 h-5" />
            </button>
            
            <div className="relative group">
              <button className="p-2 hover:bg-dark-800 rounded-lg text-dark-400 transition-colors">
                <MoreVertical className="w-5 h-5" />
              </button>
              
              <div className="absolute right-0 top-full mt-2 w-48 bg-dark-800 border border-dark-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="py-2">
                  <button
                    onClick={copyRoomLink}
                    className="flex items-center gap-3 w-full px-4 py-2 text-sm text-dark-300 hover:text-white hover:bg-dark-700"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Link
                  </button>
                  <button className="flex items-center gap-3 w-full px-4 py-2 text-sm text-dark-300 hover:text-white hover:bg-dark-700">
                    <BellOff className="w-4 h-4" />
                    Mute Notifications
                  </button>
                  <button className="flex items-center gap-3 w-full px-4 py-2 text-sm text-dark-300 hover:text-white hover:bg-dark-700">
                    <Flag className="w-4 h-4" />
                    Report Room
                  </button>
                  <hr className="my-2 border-dark-700" />
                  <button
                    onClick={handleLeaveRoom}
                    className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-dark-700"
                  >
                    <LogOut className="w-4 h-4" />
                    Leave Room
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Warning Toast */}
        <AnimatePresence>
          {aiWarning && (
            <AIWarningToast
              type={aiWarning.type}
              details={aiWarning.message}
              toxicityScore={aiWarning.toxicityScore || 0}
              fallacies={aiWarning.fallacies || []}
              suggestions={aiWarning.suggestions || []}
              onDismiss={() => setAiWarning(null)}
            />
          )}
        </AnimatePresence>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
          {/* Topic Banner */}
          {room.topic && (
            <div className="bg-gradient-to-r from-primary-500/10 to-accent-500/10 border border-primary-500/20 rounded-2xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary-500/20 rounded-lg">
                  <Brain className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white mb-1">Debate Topic</h3>
                  <p className="text-dark-300">{room.topic}</p>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, index) => (
            <ChatMessage
              key={msg._id || msg.id || index}
              message={msg}
              isOwn={msg.sender?.id === user?._id || msg.sender?._id === user?._id}
              showAvatar={index === 0 || messages[index - 1]?.sender?.id !== msg.sender?.id}
            />
          ))}

          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 text-dark-400 text-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>
                {typingUsers.map(u => u.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-dark-800 bg-dark-900/50">
          <div className="flex items-end gap-3">
            <div className="flex-1 bg-dark-800 border border-dark-700 rounded-2xl focus-within:border-primary-500 transition-colors">
              <textarea
                ref={messageInputRef}
                value={message}
                onChange={handleTyping}
                placeholder="Type your argument..."
                rows={1}
                className="w-full bg-transparent px-4 py-3 text-white placeholder-dark-400 resize-none focus:outline-none"
                style={{ minHeight: '48px', maxHeight: '120px' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
              />
              <div className="flex items-center justify-between px-3 pb-2">
                <div className="flex items-center gap-1">
                  <button type="button" className="p-2 text-dark-400 hover:text-white rounded-lg transition-colors">
                    <Smile className="w-5 h-5" />
                  </button>
                  <button type="button" className="p-2 text-dark-400 hover:text-white rounded-lg transition-colors">
                    <Paperclip className="w-5 h-5" />
                  </button>
                </div>
                <span className="text-xs text-dark-500">{message.length}/2000</span>
              </div>
            </div>
            
            <Button type="submit" disabled={!message.trim()} className="h-12 w-12 !p-0">
              <Send className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2 mt-2 text-xs text-dark-500">
            <Zap className="w-3 h-3" />
            <span>AI monitors all messages for toxicity and logical fallacies</span>
          </div>
        </form>
      </div>

      {/* Sidebar - Participants */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-l border-dark-800 bg-dark-900/50 overflow-hidden"
          >
            <div className="p-4 border-b border-dark-800">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Participants</h3>
                <Badge variant="success" size="sm">{onlineUsers.length} online</Badge>
              </div>
            </div>

            <div className="p-4 space-y-2 overflow-y-auto h-[calc(100%-60px)] scrollbar-thin">
              {/* Host */}
              {room.host && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-dark-400 uppercase mb-2">Host</h4>
                  <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-dark-800/50 transition-colors">
                    <Avatar
                      src={room.host.profile?.avatar}
                      name={room.host.username}
                      size="sm"
                      status={onlineUsers.some(u => u.id === room.host._id) ? 'online' : 'offline'}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white truncate">{room.host.username}</span>
                        <Crown className="w-4 h-4 text-amber-400" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Moderators */}
              {room.moderators?.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-dark-400 uppercase mb-2">Moderators</h4>
                  {room.moderators.map((mod) => (
                    <div key={mod._id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-dark-800/50 transition-colors">
                      <Avatar
                        src={mod.profile?.avatar}
                        name={mod.username}
                        size="sm"
                        status={onlineUsers.some(u => u.id === mod._id) ? 'online' : 'offline'}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white truncate">{mod.username}</span>
                          <Shield className="w-4 h-4 text-primary-400" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Participants */}
              <div>
                <h4 className="text-xs font-medium text-dark-400 uppercase mb-2">
                  Members ({room.participants?.length || 0})
                </h4>
                {room.participants?.map((participant) => {
                  const isOnline = onlineUsers.some(u => u.id === participant.user?._id);
                  return (
                    <div
                      key={participant.user?._id}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-dark-800/50 transition-colors"
                    >
                      <Avatar
                        src={participant.user?.profile?.avatar}
                        name={participant.user?.username}
                        size="sm"
                        status={isOnline ? 'online' : 'offline'}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-white truncate block">
                          {participant.user?.username}
                        </span>
                        <span className="text-xs text-dark-400">
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Room Info Drawer */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="absolute right-0 top-0 h-full w-96 bg-dark-900 border-l border-dark-800 shadow-2xl z-50"
          >
            <div className="p-6 border-b border-dark-800">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Room Info</h3>
                <button
                  onClick={() => setShowInfo(false)}
                  className="p-2 hover:bg-dark-800 rounded-lg text-dark-400"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h4 className="text-sm font-medium text-dark-400 mb-2">Description</h4>
                <p className="text-white">{room.description || 'No description provided.'}</p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-dark-400 mb-2">Rules</h4>
                <ul className="space-y-2">
                  {room.rules?.map((rule, i) => (
                    <li key={i} className="flex items-start gap-2 text-dark-300">
                      <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <span>{rule}</span>
                    </li>
                  )) || (
                    <li className="text-dark-400">No specific rules set</li>
                  )}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-medium text-dark-400 mb-2">Settings</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-dark-300">Max Participants</span>
                    <span className="text-white">{room.settings?.maxParticipants || 50}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-dark-300">AI Moderation</span>
                    <Badge variant={room.settings?.aiModeration ? 'success' : 'default'} size="sm">
                      {room.settings?.aiModeration ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-dark-300">Fact Checking</span>
                    <Badge variant={room.settings?.factChecking ? 'success' : 'default'} size="sm">
                      {room.settings?.factChecking ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-dark-400 mb-2">Created</h4>
                <p className="text-dark-300 text-sm">
                  {new Date(room.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>

              {(isHost || isModerator) && (
                <Button as={Link} to={`/rooms/${roomId}/settings`} variant="secondary" className="w-full" icon={Settings}>
                  Room Settings
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RoomDetail;
