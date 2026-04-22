import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  MessageSquareMore,
  PlusCircle,
  User,
  Settings,
  Shield,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
  ChevronDown,
  Sparkles,
  Moon,
  Sun,
  Zap,
} from 'lucide-react';
import { Avatar, Button, Badge, cn } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import { useSocketStore } from '../store/socketStore';

const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  
  const { user, logout, accessToken } = useAuthStore();
  const { connect, disconnect, isConnected } = useSocketStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Connect to socket on mount
  useEffect(() => {
    if (accessToken) {
      connect(accessToken);
    }
    
    return () => {
      disconnect();
    };
  }, [accessToken, connect, disconnect]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/rooms', icon: MessageSquareMore, label: 'Debate Rooms' },
    { path: '/rooms/create', icon: PlusCircle, label: 'Create Room' },
    { path: '/profile', icon: User, label: 'Profile' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  if (user?.role === 'admin' || user?.role === 'moderator') {
    navItems.push({ path: '/admin', icon: Shield, label: 'Admin Panel' });
  }

  return (
    <div className="min-h-screen bg-dark-950 mesh-overlay flex">
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 280 : 80 }}
        className="hidden lg:flex flex-col fixed left-0 top-0 h-full bg-dark-900/50 backdrop-blur-xl border-r border-dark-800 z-40"
      >
        {/* Logo */}
        <div className="p-6 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="text-xl font-bold text-white overflow-hidden whitespace-nowrap"
                >
                  {process.env.REACT_APP_BRAND || 'Zync'}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
          
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all',
                  isActive
                    ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                    : 'text-dark-300 hover:text-white hover:bg-dark-800/50'
                )
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          ))}
        </nav>

        {/* Connection Status */}
        <div className="px-4 py-4 border-t border-dark-800">
          <div className="flex items-center gap-3 px-4 py-3 bg-dark-800/50 rounded-xl">
            <div className={cn(
              'w-2.5 h-2.5 rounded-full',
              isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
            )} />
            <AnimatePresence>
              {sidebarOpen && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-dark-400"
                >
                  {isConnected ? 'Connected' : 'Disconnected'}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* User Section */}
        <div className="p-4 border-t border-dark-800">
          <div className={cn(
            'flex items-center gap-3 p-3 rounded-xl bg-dark-800/30 cursor-pointer hover:bg-dark-800/50 transition-colors',
            !sidebarOpen && 'justify-center'
          )}>
            <Avatar src={user?.profile?.avatar} alt={user?.username} size="sm" status="online" />
            <AnimatePresence>
              {sidebarOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 min-w-0"
                >
                  <p className="text-sm font-medium text-white truncate">{user?.username}</p>
                  <p className="text-xs text-dark-400 truncate">{user?.email}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-dark-900/80 backdrop-blur-xl border-b border-dark-800 z-50 flex items-center justify-between px-4">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 text-dark-400 hover:text-white rounded-lg"
        >
          <Menu className="w-6 h-6" />
        </button>
        
          <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-white">{process.env.REACT_APP_BRAND || 'Zync'}</span>
        </Link>
        
        <button className="p-2 text-dark-400 hover:text-white rounded-lg relative">
          <Bell className="w-6 h-6" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-accent-500 rounded-full" />
        </button>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-80 bg-dark-900 border-r border-dark-800 z-50 flex flex-col"
            >
              <div className="p-6 flex items-center justify-between border-b border-dark-800">
                <Link to="/dashboard" className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xl font-bold text-white">{process.env.REACT_APP_BRAND || 'Zync'}</span>
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-dark-400 hover:text-white rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all',
                        isActive
                          ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                          : 'text-dark-300 hover:text-white hover:bg-dark-800/50'
                      )
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </nav>
              
              <div className="p-4 border-t border-dark-800 space-y-3">
                <div className="flex items-center gap-3 p-3 bg-dark-800/30 rounded-xl">
                  <Avatar src={user?.profile?.avatar} alt={user?.username} size="sm" status="online" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{user?.username}</p>
                    <p className="text-xs text-dark-400 truncate">{user?.email}</p>
                  </div>
                </div>
                <Button onClick={handleLogout} variant="ghost" className="w-full justify-start" icon={LogOut}>
                  Log out
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className={cn(
        'flex-1 flex flex-col min-h-screen transition-all duration-300',
        sidebarOpen ? 'lg:ml-[280px]' : 'lg:ml-20'
      )}>
        {/* Top Bar */}
        <header className="hidden lg:flex sticky top-0 h-16 bg-dark-900/50 backdrop-blur-xl border-b border-dark-800 z-30 items-center justify-between px-6">
          {/* Search */}
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
            <input
              type="text"
              placeholder="Search rooms, users, or topics..."
              className="w-full bg-dark-800/50 border border-dark-700 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
            />
          </div>
          
          {/* Right Section */}
          <div className="flex items-center gap-4">
            {/* AI Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-400 font-medium">AI Active</span>
            </div>
            
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors relative"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-accent-500 rounded-full" />
              </button>
            </div>
            
            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-2 hover:bg-dark-800 rounded-xl transition-colors"
              >
                <Avatar src={user?.profile?.avatar} alt={user?.username} size="sm" status="online" />
                <span className="text-sm font-medium text-white">{user?.username}</span>
                <ChevronDown className={cn(
                  'w-4 h-4 text-dark-400 transition-transform',
                  userMenuOpen && 'rotate-180'
                )} />
              </button>
              
              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 top-full mt-2 w-56 bg-dark-900 border border-dark-800 rounded-xl shadow-xl overflow-hidden"
                  >
                    <div className="p-4 border-b border-dark-800">
                      <p className="font-medium text-white">{user?.fullName || user?.username}</p>
                      <p className="text-sm text-dark-400">{user?.email}</p>
                    </div>
                    <div className="p-2">
                      <Link
                        to="/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 text-sm text-dark-300 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
                      >
                        <User className="w-4 h-4" />
                        View Profile
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 text-sm text-dark-300 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </Link>
                    </div>
                    <div className="p-2 border-t border-dark-800">
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Log out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 lg:p-8 pt-20 lg:pt-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
