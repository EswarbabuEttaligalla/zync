import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
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
  CheckCircle,
  XCircle,
  BellOff,
  Flag,
  LogOut,
  Copy,
  Sparkles,
  Zap,
  Brain,
  Lock,
} from 'lucide-react';
import { Button, Badge, Avatar, Spinner, cn } from '../components/ui';
import { ChatMessage, AIWarningToast } from '../components/Chat';
import { useAuthStore } from '../store/authStore';
import { useSocketStore } from '../store/socketStore';
import { roomAPI } from '../services/api';
import toast from 'react-hot-toast';

const RoomDetail = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    isConnected,
    connectionStatus,
    joinRoom,
    leaveRoom,
    sendMessage,
    startTyping,
    stopTyping,
    requestSpeakerAccess,
    approveSpeakerRequest,
    rejectSpeakerRequest,
    messages: roomMessages,
    typingUsers: roomTypingUsers,
    onlineUsers: roomOnlineUsers,
    speakerRequests,
    roomState,
  } = useSocketStore();
  
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  
  const [message, setMessage] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [aiWarning, setAiWarning] = useState(null);
  const [moderationStatus, setModerationStatus] = useState(null);

  // Fetch room data
  const { data: roomData, isLoading } = useQuery({
    queryKey: ['room', roomId],
    queryFn: async () => {
      const response = await roomAPI.getRoom(roomId);
      return response.data;
    },
  });
  
  const room = roomData?.room;

  // Initial messages fetch remains a fallback until socket state arrives
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
    const handleBlockedModeration = (event) => {
      const detail = event.detail || {};
      if (detail.state === 'AI_UNAVAILABLE' || detail.state === 'PENDING_REVIEW') {
        setModerationStatus({
          state: detail.state,
          reason: detail.reason || detail.message || 'Moderation status updated.',
          blocked: false,
        });
        window.setTimeout(() => setModerationStatus(null), 6000);
        return;
      }

      setAiWarning({
        type: detail.state === 'PROFANITY_CONFIRMED' ? 'blocked' : 'toxicity',
        message: detail.message || detail.reason || 'Message blocked due to inappropriate language.',
        suggestions: detail.suggestions || ['Please rephrase your message respectfully.'],
        toxicityScore: detail.toxicityScore ?? 0,
        fallacies: detail.fallacies || [],
        state: detail.state,
      });
      window.setTimeout(() => setAiWarning(null), 5000);
    };

    const handleModerationStatus = (event) => {
      const detail = event.detail || {};
      if (detail.state === 'AI_UNAVAILABLE' || detail.state === 'PENDING_REVIEW') {
        setModerationStatus({
          state: detail.state,
          reason: detail.reason || detail.message || 'Moderation status updated.',
          blocked: false,
        });
        window.setTimeout(() => setModerationStatus(null), 6000);
      }
    };

    window.addEventListener('ai-warning', handleBlockedModeration);
    window.addEventListener('moderation:status', handleModerationStatus);
    return () => {
      window.removeEventListener('ai-warning', handleBlockedModeration);
      window.removeEventListener('moderation:status', handleModerationStatus);
    };
  }, []);

  const fallbackMessages = initialMessages?.messages;
  const messages = useMemo(
    () => (roomMessages?.length ? roomMessages : fallbackMessages || []),
    [roomMessages, fallbackMessages]
  );
  const typingUsers = roomTypingUsers || [];
  const onlineUsers = roomOnlineUsers || [];
  const currentParticipant = roomState?.participants?.find((participant) => {
    const participantId = participant.id || participant._id || participant.userId || participant.user?.id || participant.user?._id;
    return participantId?.toString?.() === user?._id?.toString?.();
  });
  const isMuted = Boolean(currentParticipant?.isMuted && (!currentParticipant.mutedUntil || new Date(currentParticipant.mutedUntil) > new Date()));
  const pendingSpeakerRequest = speakerRequests.some((request) => request.user?._id?.toString?.() === user?._id?.toString?.() || request.user?.id?.toString?.() === user?._id?.toString?.());

  const groupedMessages = useMemo(() => messages.map((msg, index) => {
    const previous = messages[index - 1];
    const senderId = msg.sender?.id || msg.sender?._id;
    const previousSenderId = previous?.sender?.id || previous?.sender?._id;
    return {
      message: msg,
      showAvatar: index === 0 || senderId !== previousSenderId,
    };
  }), [messages]);

  const participantsByRole = useMemo(() => {
    const buckets = {
      owner: [],
      moderator: [],
      participant: [],
      viewer: [],
    };

    (roomState?.participants || []).forEach((participant) => {
      const role = participant.role || 'viewer';
      if (!buckets[role]) buckets.viewer.push(participant);
      else buckets[role].push(participant);
    });

    const sortByName = (left, right) => (left.user?.username || '').localeCompare(right.user?.username || '');
    Object.keys(buckets).forEach((key) => buckets[key].sort(sortByName));
    return buckets;
  }, [roomState?.participants]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || !canSendMessage || isMuted || !isConnected) return;

    const response = await sendMessage(roomId, message.trim());
    if (!response?.ok) {
      toast.error(response?.error || response?.reason || 'Failed to send message');
    }
    setMessage('');
    stopTyping(roomId);
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);
    if (e.target.value.length > 0) {
      startTyping(roomId);
    } else {
      stopTyping(roomId);
    }
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
  const canRequestSpeaker = roomState?.canRequestSpeaker;
  const roomRole = roomState?.role || (isHost ? 'owner' : isModerator ? 'moderator' : 'viewer');
  const canSendMessage = roomState?.canSendMessage ?? true;
  const canRequestSpeakerNow = canRequestSpeaker && !pendingSpeakerRequest;

  return (
    <div className="flex h-[calc(100vh-6rem)] -m-6 bg-dark-950">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {!isConnected && (
          <div className="px-6 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-sm flex items-center justify-between">
            <span>{connectionStatus === 'reconnecting' ? 'Reconnecting to live debate...' : 'Disconnected from live updates. Trying to recover...'}</span>
            <span className="animate-pulse">Live sync pending</span>
          </div>
        )}

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
                <Badge variant={roomRole === 'owner' || roomRole === 'moderator' ? 'primary' : 'default'} size="sm">
                  {roomRole}
                </Badge>
                {isMuted && <Badge variant="warning" size="sm">Muted</Badge>}
              </div>
              <p className="text-sm text-dark-400">{room.category}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full border', isConnected ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20')}>
              <span className={cn('h-2 w-2 rounded-full', isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse')} />
              <span className={cn('text-sm', isConnected ? 'text-emerald-400' : 'text-amber-300')}>
                {isConnected ? 'Live' : connectionStatus === 'reconnecting' ? 'Reconnecting' : 'Offline'}
              </span>
            </div>

            {/* AI Status Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-400">AI Active</span>
            </div>

            {moderationStatus && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-500/10 border border-slate-500/20 rounded-full">
                <Shield className="w-4 h-4 text-slate-300" />
                <span className="text-sm text-slate-300">
                  {moderationStatus.state === 'AI_UNAVAILABLE' ? 'Moderation fallback active' : 'Message under review'}
                </span>
              </div>
            )}

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
              toxicityScore={aiWarning.state === 'TOXIC_CONFIRMED' ? (aiWarning.toxicityScore || 0) : 0}
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
          {groupedMessages.map(({ message: msg, showAvatar }, index) => (
            <ChatMessage
              key={msg._id || msg.id || index}
              message={msg}
              isOwn={msg.sender?.id === user?._id || msg.sender?._id === user?._id}
              showAvatar={showAvatar}
            />
          ))}

          {messages.length === 0 && (
            <div className="rounded-3xl border border-dashed border-dark-700 bg-dark-900/40 p-8 text-center">
              <Sparkles className="mx-auto mb-3 h-8 w-8 text-primary-400" />
              <h3 className="text-white font-semibold mb-1">No messages yet</h3>
              <p className="text-dark-400 text-sm">Be the first to start the debate. Live moderation and reactions will appear here.</p>
            </div>
          )}

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
                placeholder={canSendMessage ? 'Type your argument...' : 'Request speaker access to send messages'}
                rows={1}
                className="w-full bg-transparent px-4 py-3 text-white placeholder-dark-400 resize-none focus:outline-none"
                style={{ minHeight: '48px', maxHeight: '120px' }}
                disabled={!canSendMessage || isMuted || !isConnected}
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
            
            <Button type="submit" disabled={!message.trim() || !canSendMessage || isMuted || !isConnected} className="h-12 w-12 !p-0">
              <Send className="w-5 h-5" />
            </Button>
          </div>
          {!isConnected && (
            <p className="mt-3 text-xs text-amber-300">You can still type, but sending is disabled until the live connection recovers.</p>
          )}
          {isMuted && (
            <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
              Your messages are currently muted. You can continue reading and reacting, but sending is disabled.
            </div>
          )}
          {canRequestSpeaker && (
            <div className="flex items-center justify-between mt-3 rounded-xl border border-primary-500/20 bg-primary-500/5 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-white">Need to speak in this room?</p>
                <p className="text-xs text-dark-400">Request speaker access and the owner will be notified instantly.</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!canRequestSpeakerNow}
                onClick={async () => {
                  const response = await requestSpeakerAccess(roomId, 'I would like to join the debate as a speaker.');
                  if (response?.ok) toast.success('Speaker request sent');
                  else toast.error(response?.error || 'Unable to send request');
                }}
              >
                {pendingSpeakerRequest ? 'Request Pending' : 'Request Access'}
              </Button>
            </div>
          )}
          
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
              {isHost && speakerRequests.length > 0 && (
                <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
                  <h4 className="text-xs font-medium text-amber-400 uppercase mb-2">Speaker Requests</h4>
                  <div className="space-y-2">
                    {speakerRequests.map((request) => (
                      <div key={request.id} className="rounded-xl border border-dark-700 bg-dark-800/60 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-white truncate">{request.user?.username || 'User'}</span>
                          <span className="text-[11px] text-dark-400">pending</span>
                        </div>
                        <p className="mt-1 text-xs text-dark-400">{request.message || 'No message provided'}</p>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" onClick={async () => approveSpeakerRequest(roomId, request.id)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="secondary" onClick={async () => rejectSpeakerRequest(roomId, request.id, 'Not enough room time right now')}>
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                  Members ({roomState?.participants?.length || room.participants?.length || 0})
                </h4>
                {(['owner', 'moderator', 'participant', 'viewer']).map((role) => {
                  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
                  const participants = participantsByRole[role] || [];
                  if (participants.length === 0) return null;

                  return (
                    <div key={role} className="mb-4 last:mb-0">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-dark-500">{roleLabel}</span>
                        <span className="text-[11px] text-dark-500">{participants.length}</span>
                      </div>
                      <div className="space-y-1">
                        {participants.map((participant) => {
                          const participantId = participant.user?._id || participant.id || participant.userId;
                          const isOnline = onlineUsers.some(u => (u.id || u._id)?.toString?.() === participantId?.toString?.());
                          return (
                            <div
                              key={participantId}
                              className="flex items-center gap-3 p-2 rounded-xl hover:bg-dark-800/50 transition-colors"
                            >
                              <Avatar
                                src={participant.user?.profile?.avatar}
                                name={participant.user?.username}
                                size="sm"
                                status={isOnline ? 'online' : 'offline'}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-white truncate block">
                                    {participant.user?.username}
                                  </span>
                                  <Badge size="sm" variant={role === 'owner' ? 'warning' : role === 'moderator' ? 'primary' : 'default'}>
                                    {roleLabel}
                                  </Badge>
                                </div>
                                <span className="text-xs text-dark-400">
                                  {isOnline ? 'Online' : participant.lastSeenAt ? `Last seen ${new Date(participant.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Offline'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {roomState?.participants?.length === 0 && (
                <div className="rounded-2xl border border-dashed border-dark-700 p-4 text-center text-dark-400">
                  No participants loaded yet.
                </div>
              )}
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
