import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  MessageSquare,
  Users,
  PlusCircle,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Trophy,
  Target,
  Zap,
} from 'lucide-react';
import { Button, Card, Badge, Skeleton, EmptyState } from '../components/ui';
import { StatCard, RoomCard, ActivityItem } from '../components/Cards';
import { useAuthStore } from '../store/authStore';
import { userAPI, roomAPI } from '../services/api';

const Dashboard = () => {
  const { user } = useAuthStore();

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await userAPI.getDashboard();
      return response.data;
    },
  });

  const { data: publicRooms } = useQuery({
    queryKey: ['rooms', 'public'],
    queryFn: async () => {
      const response = await roomAPI.getRooms({ limit: 4 });
      return response.data;
    },
  });

  const stats = [
    {
      icon: MessageSquare,
      label: 'Rooms Created',
      value: dashboardData?.stats?.roomsCreated || 0,
      color: 'primary',
    },
    {
      icon: Users,
      label: 'Rooms Joined',
      value: dashboardData?.stats?.roomsJoined || 0,
      color: 'success',
    },
    {
      icon: TrendingUp,
      label: 'Messages Sent',
      value: dashboardData?.stats?.totalMessages || 0,
      color: 'info',
    },
    {
      icon: AlertTriangle,
      label: 'Warnings',
      value: dashboardData?.stats?.warningsReceived || 0,
      color: 'warning',
    },
  ];

  const quickActions = [
    {
      icon: PlusCircle,
      label: 'Create Room',
      description: 'Start a new debate',
      to: '/rooms/create',
      gradient: 'from-primary-500 to-primary-600',
    },
    {
      icon: MessageSquare,
      label: 'Browse Rooms',
      description: 'Join active debates',
      to: '/rooms',
      gradient: 'from-emerald-500 to-teal-500',
    },
    {
      icon: Trophy,
      label: 'Leaderboard',
      description: 'See top debaters',
      to: '/leaderboard',
      gradient: 'from-amber-500 to-orange-500',
    },
    {
      icon: Target,
      label: 'Challenges',
      description: 'Daily debate topics',
      to: '/challenges',
      gradient: 'from-pink-500 to-rose-500',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-primary-500/10 to-accent-500/10 border border-primary-500/20 rounded-3xl p-8"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="primary" icon={Sparkles}>Pro Debater</Badge>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome back, {user?.profile?.firstName || user?.username}!
            </h1>
            <p className="text-dark-400">
              Ready to engage in meaningful debates? Your AI moderator is active and monitoring.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button as={Link} to="/rooms/create" icon={PlusCircle}>
              Create Room
            </Button>
            <Button as={Link} to="/rooms" variant="secondary" icon={ArrowRight} iconPosition="right">
              Browse Rooms
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {isLoading
          ? [...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))
          : stats.map((stat, index) => (
              <StatCard key={index} {...stat} />
            ))}
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <Link key={index} to={action.to}>
              <motion.div
                whileHover={{ y: -2 }}
                className="group bg-dark-900/50 border border-dark-800 hover:border-dark-700 rounded-2xl p-5 transition-colors"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center mb-4`}>
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-white group-hover:text-primary-400 transition-colors">
                  {action.label}
                </h3>
                <p className="text-sm text-dark-400">{action.description}</p>
              </motion.div>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* My Rooms */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">My Rooms</h2>
            <Link to="/rooms" className="text-sm text-primary-400 hover:text-primary-300">
              View all
            </Link>
          </div>
          
          <Card className="p-0 overflow-hidden">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : dashboardData?.myRooms?.length > 0 ? (
              <div className="divide-y divide-dark-800">
                {dashboardData.myRooms.slice(0, 5).map((room) => (
                  <RoomCard key={room.roomId} room={room} variant="compact" />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={MessageSquare}
                title="No rooms yet"
                description="Create your first debate room to get started"
                action={
                  <Button as={Link} to="/rooms/create" size="sm" icon={PlusCircle}>
                    Create Room
                  </Button>
                }
              />
            )}
          </Card>
        </motion.div>

        {/* Activity Feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Recent Activity</h2>
          </div>
          
          <Card className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : dashboardData?.recentMessages?.length > 0 ? (
              <div className="divide-y divide-dark-800">
                {dashboardData.recentMessages.map((msg, i) => (
                  <ActivityItem
                    key={i}
                    type="message"
                    user={user?.username}
                    room={msg.room?.name}
                    message={msg.content}
                    timestamp={msg.createdAt}
                  />
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-dark-400 text-sm">
                No recent activity
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Trending Rooms */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-white">Trending Debates</h2>
            <Badge variant="success" icon={Zap}>Live</Badge>
          </div>
          <Link to="/rooms" className="text-sm text-primary-400 hover:text-primary-300">
            View all
          </Link>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {publicRooms?.rooms?.slice(0, 4).map((room) => (
            <RoomCard key={room.roomId} room={room} />
          ))}
          
          {!publicRooms && (
            [...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))
          )}
        </div>
      </motion.div>

      {/* AI Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-gradient-to-br from-dark-900 to-dark-950 border border-dark-800 rounded-2xl p-6"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">AI Insights</h3>
            <p className="text-dark-400 text-sm mb-4">
              Based on your debate patterns, here are personalized recommendations to improve your argumentation.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-dark-800/50 rounded-xl">
                <div className="text-2xl font-bold text-emerald-400 mb-1">87%</div>
                <div className="text-sm text-dark-400">Logical consistency</div>
              </div>
              <div className="p-4 bg-dark-800/50 rounded-xl">
                <div className="text-2xl font-bold text-primary-400 mb-1">92%</div>
                <div className="text-sm text-dark-400">Respectful communication</div>
              </div>
              <div className="p-4 bg-dark-800/50 rounded-xl">
                <div className="text-2xl font-bold text-amber-400 mb-1">78%</div>
                <div className="text-sm text-dark-400">Citation accuracy</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
