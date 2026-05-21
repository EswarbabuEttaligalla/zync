import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Filter,
  PlusCircle,
  Grid3X3,
  List,
  Globe,
  Lock,
  Users,
  TrendingUp,
  ChevronDown,
  MessageSquare,
} from 'lucide-react';
import { Button, Badge, Skeleton, EmptyState, cn } from '../components/ui';
import { RoomCard } from '../components/Cards';
import { roomAPI } from '../services/api';

const categories = [
  { value: '', label: 'All Categories' },
  { value: 'politics', label: 'Politics', icon: '🏛️' },
  { value: 'technology', label: 'Technology', icon: '💻' },
  { value: 'science', label: 'Science', icon: '🔬' },
  { value: 'philosophy', label: 'Philosophy', icon: '🤔' },
  { value: 'society', label: 'Society', icon: '🌍' },
  { value: 'economics', label: 'Economics', icon: '📈' },
  { value: 'environment', label: 'Environment', icon: '🌱' },
  { value: 'health', label: 'Health', icon: '🏥' },
  { value: 'education', label: 'Education', icon: '📚' },
  { value: 'other', label: 'Other', icon: '💬' },
];

const Rooms = () => {
  const [view, setView] = useState('grid');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['rooms', { category, status, search, page }],
    queryFn: async () => {
      const response = await roomAPI.getRooms({ category, status, search, page, limit: 12 });
      return response.data;
    },
  });

  const { data: myRooms } = useQuery({
    queryKey: ['myRooms'],
    queryFn: async () => {
      const response = await roomAPI.getMyRooms();
      return response.data;
    },
  });

  const { data: joinedRooms } = useQuery({
    queryKey: ['joinedRooms'],
    queryFn: async () => {
      const response = await roomAPI.getJoinedRooms();
      return response.data;
    },
  });

  const tabs = [
    { id: 'all', label: 'All Rooms', icon: Globe, count: data?.pagination?.total },
    { id: 'my', label: 'My Rooms', icon: Users, count: myRooms?.rooms?.length },
    { id: 'joined', label: 'Joined', icon: TrendingUp, count: joinedRooms?.rooms?.length },
  ];

  const [activeTab, setActiveTab] = useState('all');

  const getRoomsForTab = () => {
    switch (activeTab) {
      case 'my':
        return myRooms?.rooms || [];
      case 'joined':
        return joinedRooms?.rooms || [];
      default:
        return data?.rooms || [];
    }
  };

  const rooms = getRoomsForTab();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Debate Rooms</h1>
          <p className="text-dark-400">Join active debates or create your own</p>
        </div>
        
        <Button as={Link} to="/rooms/create" icon={PlusCircle}>
          Create Room
        </Button>
      </div>

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
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <Badge variant="default" size="sm">{tab.count}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
          <input
            type="text"
            placeholder="Search rooms by name, topic, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-dark-900/50 border border-dark-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
          />
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 rounded-xl border transition-colors',
              showFilters
                ? 'bg-primary-500/10 border-primary-500/20 text-primary-400'
                : 'bg-dark-900/50 border-dark-700 text-dark-300 hover:text-white hover:border-dark-600'
            )}
          >
            <Filter className="w-5 h-5" />
            <span>Filters</span>
            <ChevronDown className={cn('w-4 h-4 transition-transform', showFilters && 'rotate-180')} />
          </button>

          {/* View Toggle */}
          <div className="flex items-center bg-dark-900/50 border border-dark-700 rounded-xl p-1">
            <button
              onClick={() => setView('grid')}
              className={cn(
                'p-2 rounded-lg transition-colors',
                view === 'grid' ? 'bg-dark-700 text-white' : 'text-dark-400 hover:text-white'
              )}
            >
              <Grid3X3 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                'p-2 rounded-lg transition-colors',
                view === 'list' ? 'bg-dark-700 text-white' : 'text-dark-400 hover:text-white'
              )}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-dark-900/50 border border-dark-800 rounded-2xl p-6 overflow-hidden"
          >
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Category</label>
                <div className="flex flex-wrap gap-2">
                  {categories.slice(0, 6).map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setCategory(cat.value)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm transition-colors',
                        category === cat.value
                          ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                          : 'bg-dark-800 text-dark-300 hover:text-white'
                      )}
                    >
                      {cat.icon && <span className="mr-1">{cat.icon}</span>}
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Status</label>
                <div className="flex gap-2">
                  {[
                    { value: '', label: 'All' },
                    { value: 'active', label: 'Active' },
                    { value: 'waiting', label: 'Waiting' },
                  ].map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setStatus(s.value)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm transition-colors',
                        status === s.value
                          ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                          : 'bg-dark-800 text-dark-300 hover:text-white'
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Privacy Filter */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Privacy</label>
                <div className="flex gap-2">
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-dark-800 text-dark-300 hover:text-white rounded-lg text-sm transition-colors">
                    <Globe className="w-4 h-4" />
                    Public
                  </button>
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-dark-800 text-dark-300 hover:text-white rounded-lg text-sm transition-colors">
                    <Lock className="w-4 h-4" />
                    Private
                  </button>
                </div>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Sort By</label>
                <select className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50">
                  <option value="newest">Newest First</option>
                  <option value="popular">Most Popular</option>
                  <option value="active">Most Active</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Filters */}
      {(category || status) && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-dark-400">Active filters:</span>
          {category && (
            <Badge
              variant="primary"
              size="sm"
              className="cursor-pointer"
              onClick={() => setCategory('')}
            >
              {categories.find(c => c.value === category)?.label} ×
            </Badge>
          )}
          {status && (
            <Badge
              variant="primary"
              size="sm"
              className="cursor-pointer"
              onClick={() => setStatus('')}
            >
              {status} ×
            </Badge>
          )}
        </div>
      )}

      {/* Rooms Grid/List */}
      {isLoading ? (
        <div className={cn(
          'gap-4',
          view === 'grid' ? 'grid md:grid-cols-2 lg:grid-cols-3' : 'space-y-4'
        )}>
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className={view === 'grid' ? 'h-72 rounded-2xl' : 'h-24 rounded-xl'} />
          ))}
        </div>
      ) : rooms.length > 0 ? (
        <div className={cn(
          'gap-4',
          view === 'grid' ? 'grid md:grid-cols-2 lg:grid-cols-3' : 'space-y-3'
        )}>
          {rooms.map((room) => (
            <RoomCard
              key={room.roomId}
              room={room}
              variant={view === 'list' ? 'compact' : 'default'}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={MessageSquare}
          title={activeTab === 'my' ? 'No rooms created' : activeTab === 'joined' ? 'No rooms joined' : 'No rooms found'}
          description={
            activeTab === 'my'
              ? 'Create your first debate room to start engaging discussions'
              : activeTab === 'joined'
              ? 'Join a room to participate in debates'
              : 'Try adjusting your filters or search terms'
          }
          action={
            activeTab === 'my' && (
              <Button as={Link} to="/rooms/create" icon={PlusCircle}>
                Create Room
              </Button>
            )
          }
        />
      )}

      {/* Pagination */}
      {data?.pagination && data.pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          
          <div className="flex items-center gap-1">
            {[...Array(Math.min(5, data.pagination.pages))].map((_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={i}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    'w-10 h-10 rounded-lg text-sm font-medium transition-colors',
                    page === pageNum
                      ? 'bg-primary-500 text-white'
                      : 'text-dark-400 hover:text-white hover:bg-dark-800'
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))}
            disabled={page === data.pagination.pages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default Rooms;
