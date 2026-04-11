import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  Key,
  CreditCard,
  HelpCircle,
  LogOut,
  Camera,
  Save,
  Moon,
  Sun,
  Monitor,
  Check,
  AlertTriangle,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { Button, Card, Badge, Avatar, cn } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import { userAPI } from '../services/api';
import toast from 'react-hot-toast';

const Settings = () => {
  const queryClient = useQueryClient();
  const { user, logout, updateUser } = useAuthStore();
  const [activeSection, setActiveSection] = useState('profile');
  const [showPassword, setShowPassword] = useState(false);
  
  const [profile, setProfile] = useState({
    firstName: user?.profile?.firstName || '',
    lastName: user?.profile?.lastName || '',
    bio: user?.profile?.bio || '',
    location: user?.profile?.location || '',
    website: user?.profile?.website || '',
    avatar: user?.profile?.avatar || '',
  });

  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    pushNotifications: true,
    roomInvites: true,
    newMessages: true,
    aiAlerts: true,
    weeklyDigest: false,
  });

  const [privacy, setPrivacy] = useState({
    profileVisible: true,
    showOnlineStatus: true,
    allowMessages: true,
    showActivity: true,
  });

  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data) => userAPI.updateProfile(data),
    onSuccess: (response) => {
      updateUser(response.data.user);
      toast.success('Profile updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data) => userAPI.updateSettings(data),
    onSuccess: () => {
      toast.success('Settings updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update settings');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data) => userAPI.changePassword(data),
    onSuccess: () => {
      toast.success('Password changed successfully');
      setPasswords({ current: '', new: '', confirm: '' });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to change password');
    },
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({ profile });
  };

  const handleSaveNotifications = () => {
    updateSettingsMutation.mutate({ notifications });
  };

  const handleSavePrivacy = () => {
    updateSettingsMutation.mutate({ preferences: privacy });
  };

  const handleChangePassword = () => {
    if (passwords.new !== passwords.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (passwords.new.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    changePasswordMutation.mutate({
      currentPassword: passwords.current,
      newPassword: passwords.new,
    });
  };

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'security', label: 'Security', icon: Key },
    { id: 'ai', label: 'AI Preferences', icon: Sparkles },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-dark-400">Manage your account settings and preferences</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-64 shrink-0">
          <Card className="p-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  'flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left transition-colors',
                  activeSection === section.id
                    ? 'bg-primary-500/10 text-primary-400'
                    : 'text-dark-300 hover:text-white hover:bg-dark-800'
                )}
              >
                <section.icon className="w-5 h-5" />
                <span className="font-medium">{section.label}</span>
              </button>
            ))}
            
            <hr className="my-2 border-dark-800" />
            
            <button
              onClick={logout}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Log Out</span>
            </button>
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Profile Section */}
            {activeSection === 'profile' && (
              <Card>
                <h2 className="text-xl font-semibold text-white mb-6">Profile Settings</h2>
                
                {/* Avatar */}
                <div className="flex items-center gap-6 mb-8">
                  <div className="relative">
                    <Avatar src={profile.avatar} name={user?.username} size="xl" />
                    <button className="absolute bottom-0 right-0 p-2 bg-primary-500 rounded-full text-white hover:bg-primary-600 transition-colors">
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <h3 className="font-medium text-white">Profile Photo</h3>
                    <p className="text-sm text-dark-400 mb-2">PNG, JPG up to 5MB</p>
                    <Button variant="secondary" size="sm">Upload Photo</Button>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={profile.firstName}
                      onChange={(e) => setProfile(p => ({ ...p, firstName: e.target.value }))}
                      className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={profile.lastName}
                      onChange={(e) => setProfile(p => ({ ...p, lastName: e.target.value }))}
                      className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Bio
                    </label>
                    <textarea
                      value={profile.bio}
                      onChange={(e) => setProfile(p => ({ ...p, bio: e.target.value }))}
                      rows={3}
                      className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 resize-none"
                      placeholder="Tell others about yourself..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={profile.location}
                      onChange={(e) => setProfile(p => ({ ...p, location: e.target.value }))}
                      className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                      placeholder="New York, USA"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Website
                    </label>
                    <input
                      type="url"
                      value={profile.website}
                      onChange={(e) => setProfile(p => ({ ...p, website: e.target.value }))}
                      className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                      placeholder="https://example.com"
                    />
                  </div>
                </div>

                <div className="flex justify-end mt-6 pt-6 border-t border-dark-800">
                  <Button onClick={handleSaveProfile} loading={updateProfileMutation.isPending} icon={Save}>
                    Save Changes
                  </Button>
                </div>
              </Card>
            )}

            {/* Notifications Section */}
            {activeSection === 'notifications' && (
              <Card>
                <h2 className="text-xl font-semibold text-white mb-6">Notification Settings</h2>
                
                <div className="space-y-6">
                  {[
                    { key: 'emailNotifications', label: 'Email Notifications', description: 'Receive notifications via email' },
                    { key: 'pushNotifications', label: 'Push Notifications', description: 'Browser push notifications' },
                    { key: 'roomInvites', label: 'Room Invites', description: 'Get notified about room invitations' },
                    { key: 'newMessages', label: 'New Messages', description: 'Notifications for new chat messages' },
                    { key: 'aiAlerts', label: 'AI Alerts', description: 'Notifications from AI moderation' },
                    { key: 'weeklyDigest', label: 'Weekly Digest', description: 'Weekly summary of your activity' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-white">{item.label}</h4>
                        <p className="text-sm text-dark-400">{item.description}</p>
                      </div>
                      <button
                        onClick={() => setNotifications(n => ({ ...n, [item.key]: !n[item.key] }))}
                        className={cn(
                          'w-12 h-6 rounded-full transition-colors relative',
                          notifications[item.key] ? 'bg-primary-500' : 'bg-dark-700'
                        )}
                      >
                        <div className={cn(
                          'w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform',
                          notifications[item.key] ? 'translate-x-6' : 'translate-x-0.5'
                        )} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end mt-6 pt-6 border-t border-dark-800">
                  <Button onClick={handleSaveNotifications} loading={updateSettingsMutation.isPending} icon={Save}>
                    Save Changes
                  </Button>
                </div>
              </Card>
            )}

            {/* Privacy Section */}
            {activeSection === 'privacy' && (
              <Card>
                <h2 className="text-xl font-semibold text-white mb-6">Privacy Settings</h2>
                
                <div className="space-y-6">
                  {[
                    { key: 'profileVisible', label: 'Public Profile', description: 'Make your profile visible to everyone' },
                    { key: 'showOnlineStatus', label: 'Online Status', description: 'Show when you are online' },
                    { key: 'allowMessages', label: 'Allow Messages', description: 'Allow others to message you' },
                    { key: 'showActivity', label: 'Activity Status', description: 'Show your recent debate activity' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-white">{item.label}</h4>
                        <p className="text-sm text-dark-400">{item.description}</p>
                      </div>
                      <button
                        onClick={() => setPrivacy(p => ({ ...p, [item.key]: !p[item.key] }))}
                        className={cn(
                          'w-12 h-6 rounded-full transition-colors relative',
                          privacy[item.key] ? 'bg-primary-500' : 'bg-dark-700'
                        )}
                      >
                        <div className={cn(
                          'w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform',
                          privacy[item.key] ? 'translate-x-6' : 'translate-x-0.5'
                        )} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end mt-6 pt-6 border-t border-dark-800">
                  <Button onClick={handleSavePrivacy} loading={updateSettingsMutation.isPending} icon={Save}>
                    Save Changes
                  </Button>
                </div>
              </Card>
            )}

            {/* Appearance Section */}
            {activeSection === 'appearance' && (
              <Card>
                <h2 className="text-xl font-semibold text-white mb-6">Appearance</h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-3">Theme</label>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { id: 'dark', label: 'Dark', icon: Moon },
                        { id: 'light', label: 'Light', icon: Sun },
                        { id: 'system', label: 'System', icon: Monitor },
                      ].map((theme) => (
                        <button
                          key={theme.id}
                          className={cn(
                            'flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors',
                            theme.id === 'dark'
                              ? 'bg-primary-500/10 border-primary-500 text-primary-400'
                              : 'bg-dark-800 border-dark-700 text-dark-300 hover:text-white'
                          )}
                        >
                          <theme.icon className="w-6 h-6" />
                          <span className="font-medium">{theme.label}</span>
                          {theme.id === 'dark' && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-3">Accent Color</label>
                    <div className="flex gap-3">
                      {['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'].map((color) => (
                        <button
                          key={color}
                          className={cn(
                            'w-10 h-10 rounded-full transition-transform hover:scale-110',
                            color === '#6366f1' && 'ring-2 ring-offset-2 ring-offset-dark-900 ring-white'
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Security Section */}
            {activeSection === 'security' && (
              <div className="space-y-6">
                <Card>
                  <h2 className="text-xl font-semibold text-white mb-6">Change Password</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-dark-300 mb-2">
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={passwords.current}
                          onChange={(e) => setPasswords(p => ({ ...p, current: e.target.value }))}
                          className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 pr-12 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-dark-300 mb-2">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={passwords.new}
                        onChange={(e) => setPasswords(p => ({ ...p, new: e.target.value }))}
                        className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-dark-300 mb-2">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={passwords.confirm}
                        onChange={(e) => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                        className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end mt-6 pt-6 border-t border-dark-800">
                    <Button onClick={handleChangePassword} loading={changePasswordMutation.isPending} icon={Key}>
                      Change Password
                    </Button>
                  </div>
                </Card>

                <Card className="border-red-500/20">
                  <h2 className="text-xl font-semibold text-red-400 mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Danger Zone
                  </h2>
                  <p className="text-dark-400 mb-4">
                    Permanently delete your account and all of your data. This action cannot be undone.
                  </p>
                  <Button variant="ghost" className="text-red-400 border-red-500/30 hover:bg-red-500/10" icon={Trash2}>
                    Delete Account
                  </Button>
                </Card>
              </div>
            )}

            {/* AI Preferences Section */}
            {activeSection === 'ai' && (
              <Card>
                <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-primary-400" />
                  AI Preferences
                </h2>
                
                <div className="space-y-6">
                  <div className="bg-primary-500/5 border border-primary-500/20 rounded-xl p-4">
                    <p className="text-dark-300 text-sm">
                      Configure how AI moderation works for your messages and how you receive AI-powered insights.
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-white">Real-time Feedback</h4>
                      <p className="text-sm text-dark-400">Get instant feedback on your arguments</p>
                    </div>
                    <button className="w-12 h-6 rounded-full bg-primary-500 transition-colors relative">
                      <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 translate-x-6" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-white">Fallacy Detection</h4>
                      <p className="text-sm text-dark-400">Alert when logical fallacies are detected</p>
                    </div>
                    <button className="w-12 h-6 rounded-full bg-primary-500 transition-colors relative">
                      <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 translate-x-6" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-white">Fact-Check Suggestions</h4>
                      <p className="text-sm text-dark-400">Suggest fact-checking for claims</p>
                    </div>
                    <button className="w-12 h-6 rounded-full bg-primary-500 transition-colors relative">
                      <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 translate-x-6" />
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-white">Sensitivity Level</h4>
                      <span className="text-primary-400 font-medium">Medium</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      defaultValue="3"
                      className="w-full accent-primary-500"
                    />
                    <div className="flex justify-between text-xs text-dark-400 mt-1">
                      <span>Low</span>
                      <span>High</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-6 pt-6 border-t border-dark-800">
                  <Button icon={Save}>Save Preferences</Button>
                </div>
              </Card>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
