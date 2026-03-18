import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  MessageSquare,
  Shield,
  AlertTriangle,
  TrendingUp,
  Activity,
  Eye,
  Ban,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  MoreVertical,
  RefreshCw,
  Download,
  Settings,
  BarChart3,
  PieChart,
  Clock,
  Zap,
} from 'lucide-react';
import { Button, Card, Badge, Avatar, Skeleton, cn } from '../../components/ui';
import { StatCard } from '../../components/Cards';
import { adminAPI } from '../../services/api';
import toast from 'react-hot-toast';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: async () => {
      const response = await adminAPI.getStats();
      return response.data;
    },
  });

  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['adminUsers', searchQuery],
    queryFn: async () => {
      const response = await adminAPI.getUsers({ search: searchQuery, limit: 20 });
      return response.data;
    },
  });

  const { data: flaggedMessages, refetch: refetchFlagged } = useQuery({
    queryKey: ['flaggedMessages'],
    queryFn: async () => {
      const response = await adminAPI.getFlaggedMessages();
      return response.data;
    },
  });

  const overviewStats = [
    {
      icon: Users,
      label: 'Total Users',
      value: stats?.totalUsers ?? stats?.overview?.totalUsers ?? 0,
      trend: '+12%',
      trendUp: true,
      color: 'primary',
    },
    {
      icon: MessageSquare,
      label: 'Active Rooms',
      value: stats?.activeRooms ?? stats?.overview?.activeRooms ?? 0,
      trend: '+8%',
      trendUp: true,
      color: 'success',
    },
    {
      icon: Activity,
      label: 'Messages Today',
      value: stats?.messagesToday ?? stats?.overview?.messagesToday ?? 0,
      trend: '+24%',
      trendUp: true,
      color: 'info',
    },
    {
      icon: AlertTriangle,
      label: 'Flagged Content',
      value: stats?.flaggedCount ?? stats?.overview?.flaggedCount ?? stats?.overview?.flaggedMessages ?? 0,
      trend: '-5%',
      trendUp: false,
      color: 'warning',
    },
  ];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'moderation', label: 'Moderation', icon: Shield },
    { id: 'analytics', label: 'Analytics', icon: PieChart },
  ];

  const handleBanUser = async (userId) => {
    try {
      await adminAPI.updateUserStatus(userId, { status: 'banned' });
      toast.success('User banned successfully');
      refetchUsers();
    } catch (error) {
      toast.error('Failed to ban user');
    }
  };

  const handleApproveMessage = async (messageId) => {
    try {
      await adminAPI.reviewMessage(messageId, { action: 'approve' });
      toast.success('Message approved');
      refetchFlagged();
    } catch (error) {
      toast.error('Failed to approve message');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await adminAPI.reviewMessage(messageId, { action: 'delete' });
      toast.success('Message deleted');
      refetchFlagged();
    } catch (error) {
      toast.error('Failed to delete message');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Admin Dashboard</h1>
          <p className="text-dark-400">Monitor and manage the platform</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="secondary" icon={Download}>Export</Button>
          <Button variant="secondary" icon={Settings}>Settings</Button>
        </div>
      </div>

      {/* Stats Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {statsLoading
          ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
          : overviewStats.map((stat, index) => (
              <StatCard key={index} {...stat} />
            ))
        }
      </motion.div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-dark-800 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                : 'text-dark-400 hover:text-white hover:bg-dark-800'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Activity Chart Placeholder */}
            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-white">Activity Overview</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="success" icon={Zap}>Live</Badge>
                  <Button variant="ghost" size="sm" icon={RefreshCw}>Refresh</Button>
                </div>
              </div>
              
              <div className="h-64 bg-dark-800/30 rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 text-dark-600 mx-auto mb-2" />
                  <p className="text-dark-400">Activity chart will be rendered here</p>
                </div>
              </div>
            </Card>

            {/* Recent Activity */}
            <Card>
              <h3 className="font-semibold text-white mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {[
                  { action: 'New user registered', user: 'john_doe', time: '2 min ago', type: 'user' },
                  { action: 'Room created', user: 'debater99', time: '5 min ago', type: 'room' },
                  { action: 'Message flagged', user: 'angry_user', time: '10 min ago', type: 'warning' },
                  { action: 'User banned', user: 'spammer123', time: '15 min ago', type: 'ban' },
                ].map((activity, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-dark-800/30 rounded-xl">
                    <div className={cn(
                      'p-2 rounded-lg',
                      activity.type === 'user' && 'bg-primary-500/20 text-primary-400',
                      activity.type === 'room' && 'bg-emerald-500/20 text-emerald-400',
                      activity.type === 'warning' && 'bg-amber-500/20 text-amber-400',
                      activity.type === 'ban' && 'bg-red-500/20 text-red-400',
                    )}>
                      {activity.type === 'user' && <Users className="w-4 h-4" />}
                      {activity.type === 'room' && <MessageSquare className="w-4 h-4" />}
                      {activity.type === 'warning' && <AlertTriangle className="w-4 h-4" />}
                      {activity.type === 'ban' && <Ban className="w-4 h-4" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-white">{activity.action}</p>
                      <p className="text-xs text-dark-400">@{activity.user}</p>
                    </div>
                    <span className="text-xs text-dark-500">{activity.time}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Quick Stats */}
            <Card>
              <h3 className="font-semibold text-white mb-4">Platform Health</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-dark-300">AI Moderation Accuracy</span>
                    <span className="text-emerald-400 font-medium">96.5%</span>
                  </div>
                  <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                    <div className="w-[96.5%] h-full bg-emerald-500 rounded-full" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-dark-300">Server Uptime</span>
                    <span className="text-emerald-400 font-medium">99.9%</span>
                  </div>
                  <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                    <div className="w-[99.9%] h-full bg-emerald-500 rounded-full" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-dark-300">User Satisfaction</span>
                    <span className="text-primary-400 font-medium">92%</span>
                  </div>
                  <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                    <div className="w-[92%] h-full bg-primary-500 rounded-full" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-dark-300">Response Time</span>
                    <span className="text-amber-400 font-medium">45ms</span>
                  </div>
                  <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                    <div className="w-[85%] h-full bg-amber-500 rounded-full" />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h3 className="font-semibold text-white">User Management</h3>
              
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-dark-800 border border-dark-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  />
                </div>
                <Button variant="secondary" size="sm" icon={Filter}>Filters</Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-dark-400 border-b border-dark-800">
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Joined</th>
                    <th className="pb-3 font-medium">Messages</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-800">
                  {usersLoading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        <td colSpan={6} className="py-4">
                          <Skeleton className="h-12 rounded-lg" />
                        </td>
                      </tr>
                    ))
                  ) : users?.users?.length > 0 ? (
                    users.users.map((user) => (
                      <tr key={user._id} className="hover:bg-dark-800/30">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <Avatar src={user.profile?.avatar} name={user.username} size="sm" />
                            <div>
                              <p className="font-medium text-white">{user.username}</p>
                              <p className="text-sm text-dark-400">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4">
                          <Badge variant={user.role === 'admin' ? 'primary' : 'default'}>
                            {user.role}
                          </Badge>
                        </td>
                        <td className="py-4">
                          <Badge variant={user.isBanned ? 'error' : 'success'}>
                            {user.isBanned ? 'Banned' : 'Active'}
                          </Badge>
                        </td>
                        <td className="py-4 text-dark-300 text-sm">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-4 text-dark-300 text-sm">
                          {user.stats?.totalMessages || 0}
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <button className="p-2 hover:bg-dark-700 rounded-lg text-dark-400 hover:text-white transition-colors">
                              <Eye className="w-4 h-4" />
                            </button>
                            {!user.isBanned && user.role !== 'admin' && (
                              <button
                                onClick={() => handleBanUser(user._id)}
                                className="p-2 hover:bg-red-500/10 rounded-lg text-dark-400 hover:text-red-400 transition-colors"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                            <button className="p-2 hover:bg-dark-700 rounded-lg text-dark-400 hover:text-white transition-colors">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-dark-400">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Moderation Tab */}
        {activeTab === 'moderation' && (
          <div className="space-y-6">
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-white">Flagged Content</h3>
                <Badge variant="warning">{flaggedMessages?.messages?.length || 0} pending</Badge>
              </div>

              <div className="space-y-4">
                {flaggedMessages?.messages?.length > 0 ? (
                  flaggedMessages.messages.map((msg) => (
                    <div key={msg._id} className="bg-dark-800/30 border border-dark-700 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <Avatar src={msg.sender?.avatar || msg.sender?.profile?.avatar} name={msg.sender?.username || msg.user?.username} size="sm" />
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-white">{msg.sender?.username || msg.user?.username}</span>
                              <span className="text-xs text-dark-500">
                                {new Date(msg.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-dark-300 mb-2">{msg.content}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="warning" size="sm" icon={AlertTriangle}>
                                {msg.flagReason || 'Flagged by AI'}
                              </Badge>
                              {msg.aiAnalysis?.toxicity?.score != null && (
                                <Badge variant="error" size="sm">
                                  Toxicity: {Math.round(msg.aiAnalysis.toxicity.score * 100)}%
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={CheckCircle}
                            className="text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => handleApproveMessage(msg._id)}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={XCircle}
                            className="text-red-400 hover:bg-red-500/10"
                            onClick={() => handleDeleteMessage(msg._id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-dark-400">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
                    <p className="text-lg font-medium text-white mb-1">All Clear!</p>
                    <p>No flagged content pending review</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Moderation Settings */}
            <Card>
              <h3 className="font-semibold text-white mb-4">AI Moderation Settings</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-dark-300">Toxicity Threshold</span>
                    <span className="text-primary-400 font-medium">70%</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="90"
                    defaultValue="70"
                    className="w-full accent-primary-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-white">Auto-hide flagged messages</h4>
                    <p className="text-sm text-dark-400">Automatically hide messages that exceed the toxicity threshold</p>
                  </div>
                  <button className="w-12 h-6 rounded-full bg-primary-500 transition-colors relative">
                    <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 translate-x-6" />
                  </button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="font-semibold text-white mb-4">User Growth</h3>
              <div className="h-64 bg-dark-800/30 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-12 h-12 text-dark-600" />
              </div>
            </Card>
            
            <Card>
              <h3 className="font-semibold text-white mb-4">Message Volume</h3>
              <div className="h-64 bg-dark-800/30 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-12 h-12 text-dark-600" />
              </div>
            </Card>
            
            <Card>
              <h3 className="font-semibold text-white mb-4">Category Distribution</h3>
              <div className="h-64 bg-dark-800/30 rounded-xl flex items-center justify-center">
                <PieChart className="w-12 h-12 text-dark-600" />
              </div>
            </Card>
            
            <Card>
              <h3 className="font-semibold text-white mb-4">Peak Usage Times</h3>
              <div className="h-64 bg-dark-800/30 rounded-xl flex items-center justify-center">
                <Clock className="w-12 h-12 text-dark-600" />
              </div>
            </Card>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AdminDashboard;
