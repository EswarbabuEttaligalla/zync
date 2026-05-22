import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import {
  Send,
  Smile,
  AlertTriangle,
  Check,
  X,
  ThumbsUp,
  Heart,
  Flame,
  Laugh,
  PartyPopper,
  ThumbsDown,
  Shield,
  MoreHorizontal,
  Reply,
  Edit,
  Trash2,
  Paperclip,
} from 'lucide-react';
import { Avatar, Badge, Button, cn } from './ui';
import { useAuthStore } from '../store/authStore';
import { useSocketStore } from '../store/socketStore';

const REACTION_PRESETS = [
  { type: 'agree', emoji: '👍', label: 'Agree' },
  { type: 'disagree', emoji: '👎', label: 'Disagree' },
  { type: 'love', emoji: '❤️', label: 'Love' },
  { type: 'laugh', emoji: '😂', label: 'Laugh' },
  { type: 'fire', emoji: '🔥', label: 'Fire' },
  { type: 'clap', emoji: '👏', label: 'Clap' },
  { type: 'celebrate', emoji: '🙌', label: 'Celebrate' },
  { type: 'surprised', emoji: '😮', label: 'Surprised' },
  { type: 'sad', emoji: '😢', label: 'Sad' },
  { type: 'sparkle', emoji: '✨', label: 'Sparkle' },
  { type: 'boost', emoji: '🚀', label: 'Boost' },
  { type: 'strong_agree', emoji: '💯', label: 'Strong agree' },
];

const REACTION_GROUPS = [
  {
    label: 'Recent',
    items: ['👍', '❤️', '😂', '🔥'],
  },
  {
    label: 'People',
    items: ['👍', '👎', '👏', '🙌'],
  },
  {
    label: 'Emotion',
    items: ['❤️', '😂', '😮', '😢'],
  },
  {
    label: 'Energy',
    items: ['🔥', '✨', '🚀', '💯'],
  },
];

const getReactionMeta = (emoji) => REACTION_PRESETS.find((preset) => preset.emoji === emoji) || REACTION_PRESETS[0];

const getReactionLabel = (emoji) => getReactionMeta(emoji).label;

const getStoredRecentReactions = () => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = JSON.parse(window.localStorage.getItem('zync-recent-reactions') || '[]');
    return Array.isArray(stored) ? stored.slice(0, 6) : [];
  } catch (error) {
    return [];
  }
};

const persistRecentReaction = (emoji) => {
  if (typeof window === 'undefined') return;
  const next = [emoji, ...getStoredRecentReactions().filter((item) => item !== emoji)].slice(0, 6);
  window.localStorage.setItem('zync-recent-reactions', JSON.stringify(next));
};

// Chat Container
export const ChatContainer = ({ roomId, className }) => {
  const messagesEndRef = useRef(null);
  const { messages, typingUsers, sendMessage, startTyping, stopTyping } = useSocketStore();
  const { user } = useAuthStore();
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInputChange = (e) => {
    setMessageInput(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      startTyping(roomId);
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      stopTyping(roomId);
    }, 2000);
  };

  const handleSend = () => {
    if (!messageInput.trim()) return;
    
    sendMessage(roomId, messageInput);
    setMessageInput('');
    setIsTyping(false);
    stopTyping(roomId);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 md:space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id || index}
              message={message}
              isOwn={message.sender?.id === user?.id}
            />
          ))}
        </AnimatePresence>
        
        {/* Typing Indicator */}
        <AnimatePresence>
          {typingUsers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="sticky bottom-0 z-10 flex max-w-fit items-center gap-2 rounded-full border border-dark-700 bg-dark-900/90 px-3 py-2 text-sm text-dark-300 shadow-lg backdrop-blur"
            >
              <div className="typing-indicator compact">
                <span />
                <span />
                <span />
              </div>
              <span className="max-w-[180px] truncate md:max-w-none">
                {typingUsers.map(u => u.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-dark-800">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              value={messageInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type your argument..."
              rows={1}
              className="w-full bg-dark-800/50 border border-dark-700 rounded-xl px-4 py-3 pr-12 text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all duration-200 resize-none"
              style={{ minHeight: '48px', maxHeight: '150px' }}
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-primary-400 transition-colors" title="Add emoji">
              <Smile className="w-5 h-5" />
            </button>
          </div>
          <Button onClick={handleSend} icon={Send} disabled={!messageInput.trim()}>
            Send
          </Button>
        </div>
        <p className="text-xs text-dark-500 mt-2">
          AI moderator is actively monitoring this debate
        </p>
      </div>
    </div>
  );
};

// Chat Message Component
export const ChatMessage = ({ message, isOwn, showAvatar = true, onReply, onDelete, onEdit, onRetry }) => {
  const [showActions, setShowActions] = useState(false);
  const [reactionMenuOpen, setReactionMenuOpen] = useState(false);
  const [burstReaction, setBurstReaction] = useState(null);
  const { reactToMessage } = useSocketStore();

  const moderationState = message.moderation?.state;
  const hasConfirmedWarning = moderationState === 'TOXIC_CONFIRMED' || moderationState === 'PROFANITY_CONFIRMED';
  const hasNeutralModerationStatus = moderationState === 'AI_UNAVAILABLE' || moderationState === 'PENDING_REVIEW';
  const isFlagged = message.isFlagged || message.status === 'blocked' || message.status === 'flagged';
  const isPending = message.pending || message.status === 'pending' || message.status === 'sending';
  const isDelivered = message.status === 'delivered' || message.status === 'sent';
  const isFailed = message.status === 'failed';
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  const replySnapshot = message.replySnapshot || null;
  const reactionMap = useMemo(() => {
    const map = new Map();
    (message.reactions || []).forEach((reaction) => {
      const current = map.get(reaction.type) || [];
      map.set(reaction.type, [...current, reaction]);
    });
    return map;
  }, [message.reactions]);

  const recentReactions = getStoredRecentReactions();

  const handleReactionSelect = async (emoji) => {
    const reactionType = getReactionMeta(emoji).type;
    setBurstReaction(emoji);
    setReactionMenuOpen(false);
    persistRecentReaction(emoji);
    window.setTimeout(() => setBurstReaction(null), 600);
    await reactToMessage(message.id || message._id, reactionType);
  };

  const reactions = [
    { type: 'agree', icon: ThumbsUp, label: 'Agree' },
    { type: 'love', icon: Heart, label: 'Love' },
    { type: 'fire', icon: Flame, label: 'Fire' },
    { type: 'laugh', icon: Laugh, label: 'Laugh' },
    { type: 'clap', icon: PartyPopper, label: 'Clap' },
    { type: 'disagree', icon: ThumbsDown, label: 'Disagree' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn('group flex gap-2 md:gap-3', isOwn && 'flex-row-reverse')}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {showAvatar ? (
        <Avatar
          src={message.sender?.avatar}
          alt={message.sender?.username}
          size="sm"
          status="online"
        />
      ) : (
        <div className="w-8 shrink-0" />
      )}
      
      <div className={cn('relative max-w-[84%] sm:max-w-[75%] md:max-w-[70%]', isOwn && 'items-end')}>
        {/* Header */}
        <div className={cn('mb-1 flex items-center gap-2', isOwn && 'flex-row-reverse')}>
          <span className="font-medium text-sm text-white">
            {message.sender?.username}
          </span>
          <span className="text-xs text-dark-500">
            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
          </span>
          {message.isEdited && (
            <span className="text-xs text-dark-500">(edited)</span>
          )}
        </div>

        {/* Message Bubble */}
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl px-4 py-3 transition-all duration-300 will-change-transform',
            isOwn
              ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white'
              : 'bg-dark-800 text-dark-100',
            isFlagged && 'border-2 border-red-500/50',
            hasConfirmedWarning && !isFlagged && 'border border-amber-500/50',
            hasNeutralModerationStatus && !isFlagged && 'border border-slate-500/40',
            isPending && 'opacity-80 ring-1 ring-dashed ring-primary-500/40',
            isFailed && 'opacity-80 ring-1 ring-dashed ring-red-500/40'
          )}
        >
          {replySnapshot && (
            <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mb-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-xs text-dark-300">
              <p className="font-medium text-white/80">Replying to {replySnapshot.senderName || 'message'}</p>
              <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words">{replySnapshot.content}</p>
            </motion.div>
          )}
          {isPending && (
            <div className="mb-2 flex items-center gap-2 text-xs text-primary-300">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-300 animate-pulse" />
              Sending...
            </div>
          )}
          {isFailed && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mb-2 flex items-center gap-2 text-xs text-red-300">
              <span className="h-1.5 w-1.5 rounded-full bg-red-300" />
              Failed to send.
              {isOwn && onRetry && (
                <button type="button" onClick={() => onRetry(message)} className="font-medium text-red-200 underline decoration-red-300/50 underline-offset-2 hover:text-white">
                  Retry
                </button>
              )}
            </motion.div>
          )}
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

          {isOwn && (isPending || isDelivered) && (
            <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-white/60">
              {isPending ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-white/50 animate-pulse" />
                  <span>Sending</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Delivered</span>
                </>
              )}
            </div>
          )}

          {attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {attachments.map((attachment) => (
                <a
                  key={attachment.id || attachment.url}
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-xs text-white/80 hover:bg-black/20 transition-colors"
                >
                  <Paperclip className="h-4 w-4" />
                  <span className="min-w-0 flex-1 truncate">{attachment.name || 'Attachment'}</span>
                  <span className="text-dark-400">{attachment.size ? `${Math.round(attachment.size / 1024)} KB` : ''}</span>
                </a>
              ))}
            </div>
          )}
          
          {/* AI Warning Indicator */}
          {hasConfirmedWarning && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <div className="flex items-center gap-1.5 text-xs text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>
                  {moderationState === 'PROFANITY_CONFIRMED' ? 'Message blocked by profanity filter' : 'Potential harmful language detected'}
                </span>
              </div>
            </div>
          )}

          {hasNeutralModerationStatus && !isFlagged && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Shield className="w-3.5 h-3.5" />
                <span>
                  {moderationState === 'AI_UNAVAILABLE' ? 'Moderation running in fallback mode' : 'Message under review'}
                </span>
              </div>
            </div>
          )}

          {/* Flagged Message Overlay */}
          {isFlagged && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <div className="flex items-center gap-1.5 text-xs text-red-400">
                <Shield className="w-3.5 h-3.5" />
                <span>This message was flagged by the AI moderator</span>
              </div>
            </div>
          )}
        </div>

        {/* Fact Check Result */}
          {message.moderation?.factCheck?.performed && (
          <FactCheckBadge result={message.moderation.factCheck} />
        )}

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className={cn('mt-2 flex flex-wrap gap-1.5', isOwn && 'justify-end')}>
            {reactions.map((reaction) => {
              const reactionEntries = reactionMap.get(reaction.type) || [];
              if (reactionEntries.length === 0) return null;
              const names = reactionEntries.map((entry) => entry.username || entry.user?.username || 'Someone').slice(0, 4);
              const tooltip = `${names.join(', ')}${reactionEntries.length > names.length ? ' and others' : ''} reacted`;

              return (
                <div key={reaction.type} className="group relative">
                  <motion.button
                    whileHover={{ y: -1, scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => reactToMessage(message.id || message._id, reaction.type)}
                    className="flex items-center gap-1.5 rounded-full border border-dark-700 bg-dark-800 px-2.5 py-1 text-xs text-dark-200 transition-colors hover:border-primary-500/30 hover:bg-dark-700"
                  >
                    <reaction.icon className="h-3 w-3 text-primary-300 transition-transform group-hover:scale-110" />
                    <span>{reactionEntries.length}</span>
                  </motion.button>
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-max -translate-x-1/2 rounded-xl border border-dark-700 bg-dark-900 px-3 py-2 text-[11px] text-dark-200 shadow-xl group-hover:block">
                    <div className="max-w-[220px] space-y-1">
                      <div className="font-medium text-white">{reaction.label}</div>
                      <div className="text-dark-400">{tooltip}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Action Buttons */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className={cn(
                'mt-2 flex items-center gap-1 rounded-full border border-dark-700 bg-dark-900/95 px-2 py-1 shadow-xl backdrop-blur-sm',
                isOwn && 'justify-end'
              )}
            >
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setReactionMenuOpen((value) => !value)}
                  className="p-1.5 text-dark-400 hover:text-primary-400 hover:bg-dark-800 rounded-lg transition-colors"
                  title="React"
                >
                  <Smile className="w-4 h-4" />
                </button>
                <AnimatePresence>
                  {reactionMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.96 }}
                      className="absolute bottom-full left-0 z-30 mb-2 w-64 rounded-2xl border border-dark-700 bg-dark-900 p-3 shadow-2xl"
                    >
                      <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-wide text-dark-500">
                        <span>React</span>
                        <button type="button" onClick={() => setReactionMenuOpen(false)} className="text-dark-500 hover:text-white">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="space-y-3">
                        {[...new Set([...recentReactions, ...REACTION_GROUPS.flatMap((group) => group.items)])].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleReactionSelect(emoji)}
                            className="group flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-dark-200 transition-colors hover:bg-dark-800"
                          >
                            <span className="text-lg transition-transform group-hover:scale-110">{emoji}</span>
                            <span>{getReactionLabel(emoji)}</span>
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-dark-800 pt-3">
                        {REACTION_GROUPS.map((group) => (
                          <div key={group.label}>
                            <p className="mb-2 text-[10px] uppercase tracking-wide text-dark-500">{group.label}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {group.items.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => handleReactionSelect(emoji)}
                                  className="rounded-lg border border-dark-700 bg-dark-800 px-2 py-1.5 text-base transition-transform hover:-translate-y-0.5 hover:bg-dark-700"
                                  title={getReactionLabel(emoji)}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="h-4 w-px bg-dark-700 mx-1" />
              <button onClick={() => onReply?.(message)} className="p-1.5 text-dark-400 hover:text-primary-400 hover:bg-dark-800 rounded-lg transition-colors" title="Reply">
                <Reply className="w-4 h-4" />
              </button>
              {isOwn && (
                <>
                  <button onClick={() => onEdit?.(message)} className="p-1.5 text-dark-400 hover:text-primary-400 hover:bg-dark-800 rounded-lg transition-colors" title="Edit">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => onDelete?.(message)} className="p-1.5 text-dark-400 hover:text-red-400 hover:bg-dark-800 rounded-lg transition-colors" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {burstReaction && (
            <motion.div
              initial={{ opacity: 0, scale: 0.4, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6, y: -6 }}
              className={cn('pointer-events-none absolute -top-4 z-20 text-3xl', isOwn ? 'right-6' : 'left-6')}
            >
              {burstReaction}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// Fact Check Badge Component
const FactCheckBadge = ({ result }) => {
  const verdictStyles = {
    verified: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: Check },
    false: { bg: 'bg-red-500/20', text: 'text-red-400', icon: X },
    misleading: { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: AlertTriangle },
    'partially-true': { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: AlertTriangle },
    unverifiable: { bg: 'bg-dark-600', text: 'text-dark-300', icon: MoreHorizontal },
  };

  const style = verdictStyles[result.verdict] || verdictStyles.unverifiable;
  const Icon = style.icon;

  return (
    <div className="mt-2 p-3 bg-dark-800/50 rounded-xl border border-dark-700">
      <div className="flex items-start gap-2">
        <div className={cn('p-1.5 rounded-lg', style.bg)}>
          <Icon className={cn('w-4 h-4', style.text)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-medium', style.text)}>
              {result.verdict.charAt(0).toUpperCase() + result.verdict.slice(1).replace('-', ' ')}
            </span>
            <Badge size="sm" variant="default">Fact Check</Badge>
          </div>
          {result.explanation && (
            <p className="text-xs text-dark-400 mt-1">{result.explanation}</p>
          )}
          {result.sources && result.sources.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-dark-500 mb-1">Sources:</p>
              <div className="flex flex-wrap gap-1">
                {result.sources.map((source, i) => (
                  <a
                    key={i}
                    href={source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary-400 hover:underline"
                  >
                    [{i + 1}]
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// AI Warning Toast Component
export const AIWarningToast = ({ type, details, toxicityScore, fallacies, suggestions, onDismiss }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className="max-w-md bg-dark-900 border border-amber-500/50 rounded-xl p-4 shadow-xl"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-500/20 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-white mb-1">
            {type === 'toxicity' ? 'Content Warning' : type === 'blocked' ? 'Message Blocked' : 'Logical Fallacy Detected'}
          </h4>
          
          {type === 'toxicity' && toxicityScore > 0 && (
            <div className="mb-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-dark-400">Toxicity Level</span>
                <span className="text-amber-400">{Math.round(toxicityScore * 100)}%</span>
              </div>
              <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full"
                  style={{ width: `${toxicityScore * 100}%` }}
                />
              </div>
            </div>
          )}
          
          {type === 'fallacy' && fallacies && fallacies.length > 0 && (
            <div className="space-y-1 mb-2">
              {fallacies.map((fallacy, i) => (
                <Badge key={i} variant="warning" size="sm">
                  {fallacy}
                </Badge>
              ))}
            </div>
          )}

          {type === 'blocked' && (
            <div className="text-sm text-dark-400 mb-2">
              {details}
            </div>
          )}
          
          {suggestions && suggestions.length > 0 && (
            <div className="text-sm text-dark-400">
              <span className="font-medium text-dark-300">Suggestion:</span>{' '}
              {suggestions[0]}
            </div>
          )}
          
          <button
            onClick={onDismiss}
            className="mt-3 text-sm text-primary-400 hover:text-primary-300 font-medium"
          >
            Got it
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ChatContainer;
