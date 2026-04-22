import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { Avatar, Badge, Button, cn } from './ui';
import { useAuthStore } from '../store/authStore';
import { useSocketStore } from '../store/socketStore';

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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-2 text-sm text-dark-400"
            >
              <div className="typing-indicator">
                <span />
                <span />
                <span />
              </div>
              <span>
                {typingUsers.map(u => u.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
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
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-primary-400 transition-colors"
              title="Add emoji"
            >
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
export const ChatMessage = ({ message, isOwn, showAvatar = true }) => {
  const [showActions, setShowActions] = useState(false);
  const { reactToMessage } = useSocketStore();

  const hasWarning = message.moderation?.toxicity?.flagged || message.moderation?.fallacy?.detected;
  const isFlagged = message.isFlagged || message.status === 'blocked' || message.status === 'flagged';
  const isPending = message.pending || message.status === 'pending';

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
      className={cn(
        'group flex gap-3',
        isOwn && 'flex-row-reverse'
      )}
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
      
      <div className={cn('max-w-[70%]', isOwn && 'items-end')}>
        {/* Header */}
        <div className={cn('flex items-center gap-2 mb-1', isOwn && 'flex-row-reverse')}>
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
            'relative rounded-2xl px-4 py-3 transition-all duration-200',
            isOwn
              ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white'
              : 'bg-dark-800 text-dark-100',
            isFlagged && 'border-2 border-red-500/50',
            hasWarning && !isFlagged && 'border border-amber-500/50',
            isPending && 'opacity-80 ring-1 ring-dashed ring-primary-500/40'
          )}
        >
          {isPending && (
            <div className="mb-2 flex items-center gap-2 text-xs text-primary-300">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-300 animate-pulse" />
              Sending...
            </div>
          )}
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          
          {/* AI Warning Indicator */}
          {hasWarning && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <div className="flex items-center gap-1.5 text-xs text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>
                  {message.moderation?.toxicity?.flagged ? 'Potential harmful language detected' : ''}
                  {message.moderation?.fallacy?.detected ? 'Logical fallacy detected' : ''}
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
          <div className={cn('flex flex-wrap gap-1 mt-2', isOwn && 'justify-end')}>
            {reactions.map(reaction => {
              const count = message.reactions.filter(r => r.type === reaction.type).length;
              if (count === 0) return null;
              
              return (
                <button
                  key={reaction.type}
                  onClick={() => reactToMessage(message.id || message._id, reaction.type)}
                  className="flex items-center gap-1 px-2 py-1 bg-dark-800 rounded-full text-xs text-dark-300 hover:bg-dark-700 transition-colors"
                >
                  <reaction.icon className="w-3 h-3" />
                  <span>{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Action Buttons */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                'flex items-center gap-1 mt-2',
                isOwn && 'justify-end'
              )}
            >
              {reactions.map(reaction => (
                <button
                  key={reaction.type}
                  onClick={() => reactToMessage(message.id || message._id, reaction.type)}
                  className="p-1.5 text-dark-400 hover:text-primary-400 hover:bg-dark-800 rounded-lg transition-colors"
                  title={reaction.label}
                >
                  <reaction.icon className="w-4 h-4" />
                </button>
              ))}
              <div className="w-px h-4 bg-dark-700 mx-1" />
              <button className="p-1.5 text-dark-400 hover:text-primary-400 hover:bg-dark-800 rounded-lg transition-colors" title="Reply">
                <Reply className="w-4 h-4" />
              </button>
              {isOwn && (
                <>
                  <button className="p-1.5 text-dark-400 hover:text-primary-400 hover:bg-dark-800 rounded-lg transition-colors" title="Edit">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 text-dark-400 hover:text-red-400 hover:bg-dark-800 rounded-lg transition-colors" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
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
            {type === 'toxicity' ? 'Content Warning' : 'Logical Fallacy Detected'}
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
