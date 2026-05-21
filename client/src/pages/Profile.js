import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Edit3,
  Settings,
  MessageSquare,
  Users,
  Trophy,
  Calendar,
  MapPin,
  LinkIcon,
  Mail,
  Shield,
  Star,
  TrendingUp,
  Target,
  Zap,
  BarChart2,
} from 'lucide-react';
import { Button, Card, Badge, Avatar, Skeleton, cn } from '../components/ui';
import { StatCard, RoomCard } from '../components/Cards';
import { useAuthStore } from '../store/authStore';
import { userAPI, roomAPI } from '../services/api';

const Profile = () => {
  const { userId } = useParams();
  const { user: currentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');

  const isOwnProfile = !userId || userId === currentUser?._id;

  const { data: profileUser, isLoading } = useQuery({
    queryKey: ['user', userId || currentUser?._id],
    queryFn: async () => {
      if (isOwnProfile) {
        const response = await userAPI.getProfile();
        return response.data;
      }
      const response = await userAPI.getUser(userId);
      return response.data;
    },
  });

  const { data: userStats } = useQuery({
    queryKey: ['userStats', userId || currentUser?._id],
    queryFn: async () => {
      const response = await userAPI.getDashboard();
      return response.data?.stats;
    },
    enabled: isOwnProfile,
  });

  const { data: userRooms } = useQuery({
    queryKey: ['userRooms', userId || currentUser?._id],
    queryFn: async () => {
      const response = await roomAPI.getMyRooms();
      return response.data?.rooms || [];
    },
    enabled: isOwnProfile,
  });

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart2 },
    { id: 'rooms', label: 'Rooms', icon: MessageSquare },
    { id: 'achievements', label: 'Achievements', icon: Trophy },
  ];

  const stats = [
    { icon: MessageSquare, label: 'Debates', value: userStats?.roomsCreated || 0, color: 'primary' },
    { icon: Users, label: 'Participated', value: userStats?.roomsJoined || 0, color: 'success' },
    { icon: TrendingUp, label: 'Messages', value: userStats?.totalMessages || 0, color: 'info' },
    { icon: Star, label: 'Reputation', value: profileUser?.reputation || 0, color: 'warning' },
  ];

  const achievements = [
    { icon: '🎯', title: 'First Debate', description: 'Created your first debate room', unlocked: true },
    { icon: '💬', title: 'Active Debater', description: 'Sent 100+ messages', unlocked: true },
    { icon: '🏆', title: 'Fact Master', description: '10 verified claims', unlocked: true },
    { icon: '🌟', title: 'Top Contributor', description: 'Reached 1000 reputation', unlocked: false },
    { icon: '🎓', title: 'Logic Expert', description: 'No fallacies in 50 messages', unlocked: false },
    { icon: '🛡️', title: 'Moderator', description: 'Moderated 5 rooms', unlocked: false },
  ];

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-64 rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const user = profileUser || currentUser;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        {/* Cover Image */}
        <div className="h-48 rounded-t-3xl bg-gradient-to-br from-primary-500/20 via-dark-900 to-accent-500/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2220%22 height=%2220%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath d=%22M0 0h20v20H0z%22 fill=%22none%22/%3E%3Cpath d=%22M10 0v20M0 10h20%22 stroke=%22%23ffffff%22 stroke-opacity=%22.05%22/%3E%3C/svg%3E')] opacity-50" />
        </div>

        {/* Profile Info Card */}
        <Card className="relative -mt-20 mx-4 p-6">
          <div className="flex flex-col md:flex-row md:items-end gap-6">
            {/* Avatar */}
            <div className="relative -mt-20 md:-mt-24">
              <Avatar
                src={user?.profile?.avatar}
                name={user?.username}
                size="2xl"
                className="ring-4 ring-dark-900"
              />
              {user?.role === 'admin' && (
                <div className="absolute -bottom-1 -right-1 p-1.5 bg-primary-500 rounded-full">
                  <Shield className="w-4 h-4 text-white" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-2">
                <h1 className="text-2xl font-bold text-white">{user?.username}</h1>
                <div className="flex items-center gap-2">
                  <Badge variant="primary" icon={Zap}>Pro Debater</Badge>
                  {user?.role === 'admin' && <Badge variant="accent">Admin</Badge>}
                </div>
              </div>
              
              {user?.profile?.bio && (
                <p className="text-dark-300 mb-3">{user.profile.bio}</p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm text-dark-400">
                {user?.profile?.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {user.profile.location}
                  </span>
                )}
                {user?.profile?.website && (
                  <a href={user.profile.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary-400">
                    <LinkIcon className="w-4 h-4" />
                    Website
                  </a>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Joined {new Date(user?.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {isOwnProfile ? (
                <>
                  <Button as={Link} to="/settings" variant="secondary" icon={Settings}>
                    Settings
                  </Button>
                  <Button as={Link} to="/settings/profile" icon={Edit3}>
                    Edit Profile
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" icon={Mail}>Message</Button>
                  <Button icon={Users}>Follow</Button>
                </>
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
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
        {activeTab === 'overview' && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <Card>
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary-400" />
                Debate Analytics
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-dark-300">Logical Consistency</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-dark-700 rounded-full overflow-hidden">
                      <div className="w-4/5 h-full bg-emerald-500 rounded-full" />
                    </div>
                    <span className="text-emerald-400 font-medium">87%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-dark-300">Citation Accuracy</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-dark-700 rounded-full overflow-hidden">
                      <div className="w-4/5 h-full bg-primary-500 rounded-full" />
                    </div>
                    <span className="text-primary-400 font-medium">92%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-dark-300">Respectful Communication</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-dark-700 rounded-full overflow-hidden">
                      <div className="w-[95%] h-full bg-amber-500 rounded-full" />
                    </div>
                    <span className="text-amber-400 font-medium">95%</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Top Categories */}
            <Card>
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-primary-400" />
                Favorite Topics
              </h3>
              
              <div className="space-y-3">
                {[
                  { category: 'Technology', icon: '💻', count: 15, color: 'primary' },
                  { category: 'Science', icon: '🔬', count: 12, color: 'emerald' },
                  { category: 'Philosophy', icon: '🤔', count: 8, color: 'amber' },
                ].map((topic, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-xl">
                    <span className="text-2xl">{topic.icon}</span>
                    <div className="flex-1">
                      <span className="text-white font-medium">{topic.category}</span>
                      <div className="text-sm text-dark-400">{topic.count} debates</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'rooms' && (
          <div className="grid md:grid-cols-2 gap-4">
            {userRooms?.length > 0 ? (
              userRooms.map((room) => (
                <RoomCard key={room.roomId} room={room} />
              ))
            ) : (
              <Card className="col-span-2 text-center py-12">
                <MessageSquare className="w-12 h-12 text-dark-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No rooms yet</h3>
                <p className="text-dark-400 mb-4">Create your first debate room to get started</p>
                <Button as={Link} to="/rooms/create">Create Room</Button>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((achievement, i) => (
              <Card
                key={i}
                className={cn(
                  'transition-all',
                  achievement.unlocked
                    ? 'border-primary-500/20'
                    : 'opacity-50 grayscale'
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'text-3xl p-3 rounded-xl',
                    achievement.unlocked ? 'bg-primary-500/10' : 'bg-dark-800'
                  )}>
                    {achievement.icon}
                  </div>
                  <div>
                    <h4 className="font-medium text-white">{achievement.title}</h4>
                    <p className="text-sm text-dark-400">{achievement.description}</p>
                    {achievement.unlocked && (
                      <Badge variant="success" size="sm" className="mt-2">Unlocked</Badge>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Profile;
