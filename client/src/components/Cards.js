import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import {
  Users,
  MessageSquare,
  Lock,
  Clock,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Shield,
} from 'lucide-react';
import { Avatar, Badge, cn } from './ui';

// Category Icons & Colors
const categoryConfig = {
  politics: { color: 'from-red-500 to-orange-500', icon: '🏛️' },
  technology: { color: 'from-blue-500 to-cyan-500', icon: '💻' },
  science: { color: 'from-green-500 to-emerald-500', icon: '🔬' },
  philosophy: { color: 'from-purple-500 to-pink-500', icon: '🤔' },
  society: { color: 'from-yellow-500 to-orange-500', icon: '🌍' },
  economics: { color: 'from-emerald-500 to-teal-500', icon: '📈' },
  environment: { color: 'from-green-500 to-lime-500', icon: '🌱' },
  health: { color: 'from-pink-500 to-rose-500', icon: '🏥' },
  education: { color: 'from-indigo-500 to-blue-500', icon: '📚' },
  other: { color: 'from-gray-500 to-slate-500', icon: '💬' },
};

// Room Card Component
export const RoomCard = ({ room, variant = 'default' }) => {
  const category = categoryConfig[room.category] || categoryConfig.other;
  const isActive = room.status === 'active';
  const participantCount = room.participants?.length || 0;

  if (variant === 'compact') {
    return (
      <Link to={`/rooms/${room.roomId}`}>
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-4 p-4 bg-dark-900/50 hover:bg-dark-800/50 border border-dark-800 hover:border-dark-700 rounded-xl transition-all cursor-pointer group"
        >
          <div className={cn(
            'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-2xl',
            category.color
          )}>
            {category.icon}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white truncate group-hover:text-primary-400 transition-colors">
                {room.name}
              </h3>
              {room.privacy === 'private' && (
                <Lock className="w-3.5 h-3.5 text-dark-400" />
              )}
            </div>
            <p className="text-sm text-dark-400 truncate">{room.topic}</p>
          </div>
          
          <div className="flex items-center gap-3 text-dark-400">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span className="text-sm">{participantCount}</span>
            </div>
            {isActive && (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-xs font-medium">LIVE</span>
              </span>
            )}
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
          </div>
        </motion.div>
      </Link>
    );
  }

  return (
    <Link to={`/rooms/${room.roomId}`}>
      <motion.div
        whileHover={{ y: -5 }}
        className="group relative bg-dark-900/50 border border-dark-800 hover:border-dark-700 rounded-2xl overflow-hidden transition-all cursor-pointer"
      >
        {/* Gradient Header */}
        <div className={cn(
          'h-24 bg-gradient-to-br relative overflow-hidden',
          category.color
        )}>
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/20 rounded-full translate-y-1/2 -translate-x-1/2" />
          </div>
          
          <div className="absolute top-4 left-4 text-4xl">
            {category.icon}
          </div>
          
          {isActive && (
            <div className="absolute top-4 right-4">
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs font-medium">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                LIVE
              </span>
            </div>
          )}
          
          {room.privacy === 'private' && (
            <div className="absolute bottom-4 right-4 p-1.5 bg-black/30 backdrop-blur-sm rounded-lg">
              <Lock className="w-4 h-4 text-white" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3 className="font-semibold text-lg text-white group-hover:text-primary-400 transition-colors line-clamp-1">
              {room.name}
            </h3>
          </div>
          
          <p className="text-sm text-dark-400 line-clamp-2 mb-4">
            {room.description}
          </p>
          
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="primary" size="sm">
              {room.category}
            </Badge>
            {room.settings?.aiModerationEnabled && (
              <Badge variant="info" size="sm" icon={Shield}>
                AI Moderated
              </Badge>
            )}
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t border-dark-800">
            <div className="flex items-center gap-2">
              <Avatar src={room.host?.profile?.avatar} alt={room.host?.username} size="sm" />
              <div>
                <p className="text-sm font-medium text-white">{room.host?.username}</p>
                <p className="text-xs text-dark-500">Host</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-dark-400 text-sm">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span>{participantCount}/{room.maxParticipants}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>{formatDistanceToNow(new Date(room.createdAt), { addSuffix: true })}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

// Stat Card Component
export const StatCard = ({ icon: Icon, label, value, change, trend, color = 'primary', className }) => {
  const colors = {
    primary: {
      bg: 'from-primary-500/20 to-primary-600/10',
      icon: 'text-primary-400',
      border: 'border-primary-500/20',
    },
    success: {
      bg: 'from-emerald-500/20 to-emerald-600/10',
      icon: 'text-emerald-400',
      border: 'border-emerald-500/20',
    },
    warning: {
      bg: 'from-amber-500/20 to-amber-600/10',
      icon: 'text-amber-400',
      border: 'border-amber-500/20',
    },
    danger: {
      bg: 'from-red-500/20 to-red-600/10',
      icon: 'text-red-400',
      border: 'border-red-500/20',
    },
    info: {
      bg: 'from-blue-500/20 to-blue-600/10',
      icon: 'text-blue-400',
      border: 'border-blue-500/20',
    },
  };

  const colorConfig = colors[color];

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={cn(
        'stat-card bg-gradient-to-br p-6 rounded-2xl border backdrop-blur-xl',
        colorConfig.bg,
        colorConfig.border,
        className
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn('p-3 rounded-xl bg-dark-900/50', colorConfig.border)}>
          <Icon className={cn('w-6 h-6', colorConfig.icon)} />
        </div>
        {change !== undefined && (
          <div className={cn(
            'flex items-center gap-1 text-sm font-medium',
            trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-dark-400'
          )}>
            {trend === 'up' && <TrendingUp className="w-4 h-4" />}
            {trend === 'down' && <TrendingUp className="w-4 h-4 rotate-180" />}
            <span>{change}%</span>
          </div>
        )}
      </div>
      
      <div>
        <p className="text-3xl font-bold text-white mb-1">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="text-sm text-dark-400">{label}</p>
      </div>
    </motion.div>
  );
};

// Feature Card Component
export const FeatureCard = ({ icon: Icon, title, description, gradient }) => {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="group relative bg-dark-900/50 border border-dark-800 p-6 rounded-2xl overflow-hidden"
    >
      {/* Gradient glow effect */}
      <div className={cn(
        'absolute -top-24 -right-24 w-48 h-48 rounded-full opacity-0 group-hover:opacity-100 blur-3xl transition-opacity duration-500',
        gradient || 'bg-primary-500'
      )} />
      
      <div className="relative">
        <div className={cn(
          'w-14 h-14 rounded-2xl flex items-center justify-center mb-5 bg-gradient-to-br',
          gradient || 'from-primary-500 to-primary-600'
        )}>
          <Icon className="w-7 h-7 text-white" />
        </div>
        
        <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-primary-400 transition-colors">
          {title}
        </h3>
        
        <p className="text-dark-400 text-sm leading-relaxed">
          {description}
        </p>
      </div>
    </motion.div>
  );
};

// Activity Item Component
export const ActivityItem = ({ type, user, room, message, timestamp }) => {
  const typeConfig = {
    message: { icon: MessageSquare, color: 'text-primary-400' },
    join: { icon: Users, color: 'text-emerald-400' },
    create: { icon: Sparkles, color: 'text-amber-400' },
    warning: { icon: Shield, color: 'text-red-400' },
  };

  const config = typeConfig[type] || typeConfig.message;
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 p-3 hover:bg-dark-800/30 rounded-xl transition-colors">
      <div className={cn('p-2 rounded-lg bg-dark-800', config.color)}>
        <Icon className="w-4 h-4" />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm text-dark-200">
          <span className="font-medium text-white">{user}</span>
          {' '}
          {type === 'message' && 'sent a message in'}
          {type === 'join' && 'joined'}
          {type === 'create' && 'created'}
          {type === 'warning' && 'received a warning in'}
          {' '}
          {room && <span className="font-medium text-primary-400">{room}</span>}
        </p>
        {message && (
          <p className="text-xs text-dark-500 truncate mt-0.5">{message}</p>
        )}
      </div>
      
      <span className="text-xs text-dark-500 shrink-0">
        {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
      </span>
    </div>
  );
};

// Online Users List
export const OnlineUsersList = ({ users = [], className }) => {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-white">Online Now</h4>
        <Badge variant="success" size="sm">
          {users.length} online
        </Badge>
      </div>
      
      <div className="space-y-1">
        {users.slice(0, 10).map((user) => (
          <div
            key={user.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-dark-800/50 transition-colors"
          >
            <Avatar src={user.avatar} alt={user.username} size="sm" status="online" />
            <span className="text-sm text-dark-200">{user.username}</span>
          </div>
        ))}
        
        {users.length > 10 && (
          <p className="text-xs text-dark-500 text-center pt-2">
            +{users.length - 10} more
          </p>
        )}
        
        {users.length === 0 && (
          <p className="text-sm text-dark-500 text-center py-4">
            No users online
          </p>
        )}
      </div>
    </div>
  );
};

const cards = {
  RoomCard,
  StatCard,
  FeatureCard,
  ActivityItem,
  OnlineUsersList,
};

export default cards;
