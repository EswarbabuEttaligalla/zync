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
  Clock3,
  UserPlus,
  Check,
  X,
} from 'lucide-react';
import { Button, Badge, Avatar, Spinner, cn } from '../components/ui';
import { ChatMessage, AIWarningToast } from '../components/Chat';
import { useAuthStore } from '../store/authStore';
import { useSocketStore } from '../store/socketStore';
import { roomAPI, messageAPI } from '../services/api';
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
  const [replyTarget, setReplyTarget] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [aiWarning, setAiWarning] = useState(null);
  const [moderationStatus, setModerationStatus] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateSidebar = () => setShowSidebar(!mediaQuery.matches);
    updateSidebar();
    mediaQuery.addEventListener('change', updateSidebar);
    return () => mediaQuery.removeEventListener('change', updateSidebar);
  }, []);

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
  const pendingRequestCount = speakerRequests.length;

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
    const readyAttachments = attachments.filter((attachment) => attachment.status === 'ready');
    if ((!message.trim() && readyAttachments.length === 0) || !canSendMessage || isMuted || !isConnected) return;

    const response = await sendMessage(roomId, message.trim(), {
      replyTo: replyTarget?.messageId || replyTarget?._id || replyTarget?.id || null,
      replySnapshot: replyTarget || null,
      attachments: readyAttachments.map((attachment) => attachment.payload || attachment),
    });
    if (!response?.ok) {
      toast.error(response?.error || response?.reason || 'Failed to send message');
    } else {
      setReplyTarget(null);
      setAttachments([]);
    }
    setMessage('');
    stopTyping(roomId);
  };

  const uploadSelectedFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setIsUploading(true);

    const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

    try {
      const pendingItems = await Promise.all(files.map(async (file) => ({
        tempId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        file,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        previewUrl: file.type.startsWith('image/') ? await readFileAsDataUrl(file) : null,
        progress: 0,
        status: 'uploading',
      })));

      setAttachments((current) => [...current, ...pendingItems]);

      for (const item of pendingItems) {
        const dataUrl = await readFileAsDataUrl(item.file);
        const response = await messageAPI.uploadAttachment({
          fileName: item.fileName,
          mimeType: item.mimeType,
          size: item.size,
          dataUrl,
        }, {
          onUploadProgress: (progressEvent) => {
            const total = progressEvent.total || item.file.size || 1;
            const progress = Math.min(100, Math.round((progressEvent.loaded / total) * 100));
            setAttachments((current) => current.map((attachment) => (
              attachment.tempId === item.tempId
                ? { ...attachment, progress }
                : attachment
            )));
          },
        });

        const uploadedAttachment = {
          tempId: item.tempId,
          ...response.data.attachment,
          status: 'ready',
          progress: 100,
          payload: response.data.attachment,
          previewUrl: item.previewUrl || response.data.attachment.previewUrl || null,
          file: item.file,
        };

        setAttachments((current) => current.map((attachment) => (
          attachment.tempId === item.tempId ? uploadedAttachment : attachment
        )));
      }

      toast.success(`${pendingItems.length} attachment${pendingItems.length > 1 ? 's' : ''} added`);
    } catch (error) {
      setAttachments((current) => current.map((attachment) => (
        attachment.status === 'uploading'
          ? { ...attachment, status: 'failed', error: error?.message || 'Upload failed' }
          : attachment
      )));
      toast.error(error?.response?.data?.message || error.message || 'Failed to attach file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const retryAttachment = async (attachment) => {
    if (!attachment?.file) return;
    setAttachments((current) => current.filter((item) => item.tempId !== attachment.tempId));
    await uploadSelectedFiles([attachment.file]);
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);
    if (e.target.value.length > 0) {
      startTyping(roomId);
    } else {
      stopTyping(roomId);
    }
  };

  const handleReply = (targetMessage) => {
    setReplyTarget({
      messageId: targetMessage._id || targetMessage.id,
      content: targetMessage.content,
      senderName: targetMessage.sender?.username || 'Unknown',
      senderAvatar: targetMessage.sender?.avatar || null,
      createdAt: targetMessage.createdAt,
    });
    messageInputRef.current?.focus();
  };

  const handleInsertEmoji = (emoji) => {
    setMessage((current) => `${current}${emoji}`);
    messageInputRef.current?.focus();
  };

  const handleFileChange = (event) => {
    uploadSelectedFiles(event.target.files);
  };

  const removeAttachment = (attachmentId) => {
    setAttachments((current) => current.filter((attachment) => (attachment.id || attachment.url) !== attachmentId));
  };

  const handleDeleteMessage = async (targetMessage) => {
    const confirmed = window.confirm('Delete this message?');
    if (!confirmed) return;
    const response = await useSocketStore.getState().deleteMessage(targetMessage._id || targetMessage.id, roomId);
    if (!response?.ok) toast.error(response?.error || 'Failed to delete message');
  };

  const handleRetryMessage = async (targetMessage) => {
    const response = await sendMessage(roomId, targetMessage.content || '', {
      clientMessageId: targetMessage.clientMessageId || targetMessage._id || targetMessage.id,
      replyTo: targetMessage.replyTo || null,
      replySnapshot: targetMessage.replySnapshot || null,
      attachments: (targetMessage.attachments || []).filter((attachment) => attachment.status !== 'failed'),
      type: targetMessage.type || 'text',
    });

    if (!response?.ok) {
      toast.error(response?.error || 'Retry failed');
    }
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    await uploadSelectedFiles(event.dataTransfer.files);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

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
  const currentRole = roomState?.role || currentParticipant?.role || (isHost ? 'owner' : isModerator ? 'moderator' : 'viewer');
  const canManageRequests = isHost || isModerator;
  const canRequestSpeaker = roomState?.canRequestSpeaker;
  const roomRole = roomState?.role || (isHost ? 'owner' : isModerator ? 'moderator' : 'viewer');
  const canSendMessage = roomState?.canSendMessage ?? true;
  const canRequestSpeakerNow = canRequestSpeaker && !pendingSpeakerRequest;

  const handleApproveRequest = async (request) => {
    const requestId = request.id || request._id || request.requestId;
    const response = await approveSpeakerRequest(roomId, requestId, 'Approved from the room panel');
    if (response?.ok) {
      toast.success('Speaker request approved');
    } else {
      toast.error(response?.error || 'Unable to approve request');
    }
  };

  const handleRejectRequest = async (request) => {
    const requestId = request.id || request._id || request.requestId;
    const response = await rejectSpeakerRequest(roomId, requestId, 'Rejected from the room panel');
    if (response?.ok) {
      toast.success('Speaker request rejected');
    } else {
      toast.error(response?.error || 'Unable to reject request');
    }
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] -m-6 bg-dark-950">
      {/* Main Chat Area */}
      <div className="relative flex-1 flex flex-col" onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
        <AnimatePresence>
          {isDragOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-3 z-20 rounded-3xl border-2 border-dashed border-primary-400 bg-primary-500/10 backdrop-blur-sm pointer-events-none"
            >
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <Paperclip className="mx-auto mb-2 h-8 w-8 text-primary-300" />
                  <p className="text-sm font-medium text-white">Drop files to attach them</p>
                  <p className="text-xs text-dark-300">Images, PDFs, and text files upload instantly</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {!isConnected && (
          <div className="px-6 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-sm flex items-center justify-between">
            <span>{connectionStatus === 'reconnecting' ? 'Reconnecting to live debate...' : 'Disconnected from live updates. Trying to recover...'}</span>
            <span className="animate-pulse">Live sync pending</span>
          </div>
        )}

        {/* Chat Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-dark-800 bg-dark-900/50">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Link to="/rooms" className="p-2 hover:bg-dark-800 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-dark-400" />
            </Link>
            
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-semibold text-white">{room.name}</h1>
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
                'p-2 rounded-lg transition-colors md:hidden',
                showSidebar ? 'bg-primary-500/20 text-primary-400' : 'hover:bg-dark-800 text-dark-400'
              )}
            >
              <Users className="w-5 h-5" />
            </button>

            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className={cn(
                'hidden p-2 rounded-lg transition-colors md:inline-flex',
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 sm:space-y-4 scrollbar-thin">
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
              onReply={handleReply}
              onDelete={handleDeleteMessage}
              onRetry={handleRetryMessage}
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
          {replyTarget && (
            <div className="mb-3 rounded-2xl border border-primary-500/20 bg-primary-500/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-primary-400">Replying to {replyTarget.senderName}</p>
                  <p className="mt-1 text-sm text-white line-clamp-2">{replyTarget.content}</p>
                </div>
                <button type="button" onClick={() => setReplyTarget(null)} className="text-dark-400 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {attachments.length > 0 && (
            <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {attachments.map((attachment) => {
                const key = attachment.tempId || attachment.id || attachment.url;
                const isImage = Boolean(attachment.previewUrl || attachment.mimeType?.startsWith('image/'));
                const isFailed = attachment.status === 'failed';
                const isUploadingAttachment = attachment.status === 'uploading';
                return (
                  <motion.div
                    key={key}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className={cn(
                      'overflow-hidden rounded-2xl border bg-dark-800/80 shadow-lg',
                      isFailed ? 'border-red-500/30' : 'border-dark-700'
                    )}
                  >
                    {isImage ? (
                      <div className="relative aspect-video bg-dark-900">
                        <img src={attachment.previewUrl || attachment.url} alt={attachment.name} className="h-full w-full object-cover" />
                        {isUploadingAttachment && (
                          <div className="absolute inset-0 bg-black/40">
                            <div className="absolute bottom-3 left-3 right-3">
                              <div className="h-1.5 rounded-full bg-white/20">
                                <div className="h-1.5 rounded-full bg-primary-400 transition-all" style={{ width: `${attachment.progress || 0}%` }} />
                              </div>
                              <p className="mt-2 text-xs text-white">Uploading {attachment.progress || 0}%</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3">
                        <div className="rounded-xl bg-primary-500/10 p-2 text-primary-300">
                          <Paperclip className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-white">{attachment.name || attachment.fileName}</p>
                          <p className="text-xs text-dark-400">{attachment.size ? `${Math.round(attachment.size / 1024)} KB` : 'File'}</p>
                          {isUploadingAttachment && (
                            <div className="mt-2 h-1.5 rounded-full bg-dark-700">
                              <div className="h-1.5 rounded-full bg-primary-400 transition-all" style={{ width: `${attachment.progress || 0}%` }} />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 border-t border-dark-700 px-3 py-2 text-xs">
                      <span className={cn(isFailed ? 'text-red-300' : 'text-dark-400')}>
                        {isFailed ? attachment.error || 'Upload failed' : isUploadingAttachment ? 'Uploading...' : 'Ready'}
                      </span>
                      <div className="flex items-center gap-2">
                        {isFailed && (
                          <button type="button" onClick={() => retryAttachment(attachment)} className="rounded-lg border border-dark-600 px-2 py-1 text-dark-200 hover:border-primary-500/40 hover:text-white">
                            Retry
                          </button>
                        )}
                        <button type="button" onClick={() => removeAttachment(key)} className="rounded-lg border border-dark-600 px-2 py-1 text-dark-400 hover:border-red-500/40 hover:text-red-300">
                          Remove
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 bg-dark-800 border border-dark-700 rounded-2xl focus-within:border-primary-500 transition-colors">
              <textarea
                ref={messageInputRef}
                value={message}
                onChange={handleTyping}
                placeholder={canSendMessage ? 'Type your argument...' : 'Request speaker access to send messages'}
                rows={1}
                className="w-full bg-transparent px-4 py-3 text-white placeholder-dark-400 resize-none focus:outline-none"
                style={{ minHeight: '48px', maxHeight: '140px' }}
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
                  <button type="button" onClick={() => handleInsertEmoji('😊')} className="p-2 text-dark-400 hover:text-white rounded-lg transition-colors touch-manipulation" title="Insert emoji">
                    <Smile className="w-5 h-5" />
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-dark-400 hover:text-white rounded-lg transition-colors touch-manipulation" title="Attach file">
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <input ref={fileInputRef} type="file" multiple onChange={handleFileChange} className="hidden" accept="image/*,application/pdf,text/plain" />
                </div>
                <span className="text-xs text-dark-500">{message.length}/2000</span>
              </div>
            </div>
            
            <Button type="submit" disabled={(!message.trim() && attachments.every((attachment) => attachment.status === 'failed')) || !canSendMessage || isMuted || !isConnected || isUploading} className="h-12 w-full sm:w-12 !p-0">
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
                <UserPlus className="w-4 h-4" />
                {pendingSpeakerRequest ? 'Request Pending' : 'Request to Speak'}
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
            className="fixed inset-y-0 right-0 z-30 w-[min(88vw,320px)] border-l border-dark-800 bg-dark-900/95 overflow-hidden backdrop-blur md:static md:z-auto md:w-[320px]"
          >
            <div className="p-4 border-b border-dark-800">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Participants</h3>
                <Badge variant="success" size="sm">{onlineUsers.length} online</Badge>
              </div>
            </div>

            <div className="p-4 space-y-2 overflow-y-auto h-[calc(100%-60px)] scrollbar-thin">
              {canManageRequests && (
                <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-medium text-amber-400 uppercase">Pending Requests</h4>
                      <p className="text-[11px] text-dark-400">Live approval queue for speakers and room participation.</p>
                    </div>
                    <Badge variant="warning" size="sm">{pendingRequestCount}</Badge>
                  </div>

                  {speakerRequests.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-dark-700 bg-dark-900/40 p-3 text-sm text-dark-400">
                      No pending requests.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {speakerRequests.map((request) => {
                        const requestId = request.id || request._id || request.requestId;
                        const requester = request.user || {};
                        const requesterId = requester._id || requester.id || requester.userId;
                        const requesterRole = roomState?.participants?.find((participant) => {
                          const participantId = participant.id || participant._id || participant.userId || participant.user?._id || participant.user?.id;
                          return participantId?.toString?.() === requesterId?.toString?.();
                        })?.role || 'viewer';

                        return (
                          <div key={requestId} className="rounded-xl border border-dark-700 bg-dark-800/60 p-3">
                            <div className="flex items-start gap-3">
                              <Avatar
                                src={requester.profile?.avatar}
                                alt={requester.username || 'Requester'}
                                size="sm"
                                status="online"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium text-white truncate">{requester.username || 'User'}</span>
                                  <Badge variant={requesterRole === 'viewer' ? 'default' : 'primary'} size="sm">
                                    {requesterRole}
                                  </Badge>
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-[11px] text-dark-400">
                                  <Clock3 className="w-3 h-3" />
                                  <span>
                                    {request.createdAt ? new Date(request.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                  </span>
                                </div>
                                <p className="mt-2 text-xs text-dark-300">{request.message || 'No message provided'}</p>
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-end gap-2">
                              <Button size="sm" variant="secondary" onClick={() => handleRejectRequest(request)} icon={X}>
                                Reject
                              </Button>
                              <Button size="sm" onClick={() => handleApproveRequest(request)} icon={Check}>
                                Approve
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-dark-700 bg-dark-900/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-medium text-dark-300 uppercase">Owner Controls</h4>
                    <p className="text-[11px] text-dark-500">Realtime role sync and moderation actions.</p>
                  </div>
                  <Badge variant={currentRole === 'owner' ? 'warning' : currentRole === 'moderator' ? 'primary' : 'default'} size="sm">
                    {currentRole}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-dark-400">
                  <span className="rounded-full border border-dark-700 px-2 py-1">Approve requests</span>
                  <span className="rounded-full border border-dark-700 px-2 py-1">Mute users</span>
                  <span className="rounded-full border border-dark-700 px-2 py-1">Promote participants</span>
                </div>
              </div>

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
                          const roleBadge = participant.role || role;
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
                                  <Badge size="sm" variant={roleBadge === 'owner' ? 'warning' : roleBadge === 'moderator' ? 'primary' : roleBadge === 'participant' ? 'success' : 'default'}>
                                    {roleBadge}
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

      <AnimatePresence>
        {showSidebar && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSidebar(false)}
            className="fixed inset-0 z-20 bg-black/30 md:hidden"
            aria-label="Close participants sidebar"
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default RoomDetail;
