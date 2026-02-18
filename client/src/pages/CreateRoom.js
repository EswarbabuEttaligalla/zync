import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  MessageSquare,
  Globe,
  Lock,
  Users,
  Shield,
  Sparkles,
  CheckCircle,
  Plus,
  X,
  Info,
  Zap,
  Brain,
  AlertTriangle,
} from 'lucide-react';
import { Button, Card, Badge, cn } from '../components/ui';
import { roomAPI } from '../services/api';
import toast from 'react-hot-toast';

const categories = [
  { value: 'politics', label: 'Politics', icon: '🏛️', description: 'Government, policy, elections' },
  { value: 'technology', label: 'Technology', icon: '💻', description: 'Tech trends, AI, software' },
  { value: 'science', label: 'Science', icon: '🔬', description: 'Research, discoveries, theories' },
  { value: 'philosophy', label: 'Philosophy', icon: '🤔', description: 'Ethics, logic, existence' },
  { value: 'society', label: 'Society', icon: '🌍', description: 'Culture, social issues' },
  { value: 'economics', label: 'Economics', icon: '📈', description: 'Markets, finance, trade' },
  { value: 'environment', label: 'Environment', icon: '🌱', description: 'Climate, nature, sustainability' },
  { value: 'health', label: 'Health', icon: '🏥', description: 'Medicine, wellness, healthcare' },
  { value: 'education', label: 'Education', icon: '📚', description: 'Learning, schools, academia' },
  { value: 'other', label: 'Other', icon: '💬', description: 'General topics' },
];

const CreateRoom = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    topic: '',
    category: '',
    isPrivate: false,
    password: '',
    maxParticipants: 50,
    rules: [],
    newRule: '',
    settings: {
      aiModeration: true,
      factChecking: true,
      toxicityThreshold: 0.7,
      allowAnonymous: false,
      slowMode: 0,
    },
  });

  const createRoomMutation = useMutation({
    mutationFn: (data) => roomAPI.createRoom(data),
    onSuccess: (response) => {
      toast.success('Room created successfully!');
      navigate(`/rooms/${response.data.room.roomId}`);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || error.response?.data?.message || 'Failed to create room');
    },
  });

  const handleSubmit = () => {
    if (!formData.name || !formData.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    const { newRule, isPrivate, password, ...rest } = formData;
    const roomData = {
      ...rest,
      privacy: isPrivate ? 'private' : 'public',
      description: formData.description || formData.topic || 'A debate room',
      topic: formData.topic || formData.name,
    };
    if (isPrivate && password) {
      roomData.password = password;
    }
    createRoomMutation.mutate(roomData);
  };

  const addRule = () => {
    if (formData.newRule.trim() && formData.rules.length < 10) {
      setFormData(prev => ({
        ...prev,
        rules: [...prev.rules, prev.newRule.trim()],
        newRule: '',
      }));
    }
  };

  const removeRule = (index) => {
    setFormData(prev => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index),
    }));
  };

  const nextStep = () => {
    if (step === 1 && !formData.name) {
      toast.error('Please enter a room name');
      return;
    }
    if (step === 2 && !formData.category) {
      toast.error('Please select a category');
      return;
    }
    setStep(s => Math.min(s + 1, 4));
  };

  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const steps = [
    { number: 1, label: 'Basics' },
    { number: 2, label: 'Category' },
    { number: 3, label: 'Settings' },
    { number: 4, label: 'Review' },
  ];

  return (
    <div className="max-w-3xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/rooms')}
          className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-dark-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Create Debate Room</h1>
          <p className="text-dark-400">Set up your debate space with AI moderation</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((s, i) => (
          <React.Fragment key={s.number}>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors',
                  step >= s.number
                    ? 'bg-primary-500 text-white'
                    : 'bg-dark-800 text-dark-400'
                )}
              >
                {step > s.number ? <CheckCircle className="w-5 h-5" /> : s.number}
              </div>
              <span className={cn(
                'hidden sm:block font-medium',
                step >= s.number ? 'text-white' : 'text-dark-400'
              )}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn(
                'flex-1 h-0.5 mx-4',
                step > s.number ? 'bg-primary-500' : 'bg-dark-800'
              )} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <Card className="p-8">
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <MessageSquare className="w-12 h-12 text-primary-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white">Room Basics</h2>
              <p className="text-dark-400">Give your debate room a name and description</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Room Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Should AI be regulated?"
                className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                maxLength={100}
              />
              <p className="text-xs text-dark-500 mt-1">{formData.name.length}/100 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Debate Topic
              </label>
              <textarea
                value={formData.topic}
                onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                placeholder="Describe the main topic or question to be debated..."
                rows={3}
                className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 resize-none"
                maxLength={500}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Add context or guidelines for the debate..."
                rows={3}
                className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 resize-none"
                maxLength={1000}
              />
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <Globe className="w-12 h-12 text-primary-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white">Category & Privacy</h2>
              <p className="text-dark-400">Choose a category and set visibility</p>
            </div>

            {/* Category Selection */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-3">
                Category <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setFormData(prev => ({ ...prev, category: cat.value }))}
                    className={cn(
                      'p-4 rounded-xl border text-center transition-all',
                      formData.category === cat.value
                        ? 'bg-primary-500/10 border-primary-500 text-white'
                        : 'bg-dark-800/50 border-dark-700 text-dark-300 hover:border-dark-600 hover:text-white'
                    )}
                  >
                    <span className="text-2xl mb-2 block">{cat.icon}</span>
                    <span className="text-sm font-medium">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Privacy Toggle */}
            <div className="pt-4">
              <label className="block text-sm font-medium text-dark-300 mb-3">Privacy</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setFormData(prev => ({ ...prev, isPrivate: false }))}
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-xl border transition-all',
                    !formData.isPrivate
                      ? 'bg-primary-500/10 border-primary-500'
                      : 'bg-dark-800/50 border-dark-700 hover:border-dark-600'
                  )}
                >
                  <div className={cn(
                    'p-3 rounded-xl',
                    !formData.isPrivate ? 'bg-primary-500/20' : 'bg-dark-700'
                  )}>
                    <Globe className={cn('w-6 h-6', !formData.isPrivate ? 'text-primary-400' : 'text-dark-400')} />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-white">Public</h4>
                    <p className="text-sm text-dark-400">Anyone can join</p>
                  </div>
                </button>

                <button
                  onClick={() => setFormData(prev => ({ ...prev, isPrivate: true }))}
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-xl border transition-all',
                    formData.isPrivate
                      ? 'bg-primary-500/10 border-primary-500'
                      : 'bg-dark-800/50 border-dark-700 hover:border-dark-600'
                  )}
                >
                  <div className={cn(
                    'p-3 rounded-xl',
                    formData.isPrivate ? 'bg-primary-500/20' : 'bg-dark-700'
                  )}>
                    <Lock className={cn('w-6 h-6', formData.isPrivate ? 'text-primary-400' : 'text-dark-400')} />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-white">Private</h4>
                    <p className="text-sm text-dark-400">Password required</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Password Field */}
            {formData.isPrivate && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Room Password <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter a password for the room"
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                />
              </motion.div>
            )}
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <Sparkles className="w-12 h-12 text-primary-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white">AI & Rules</h2>
              <p className="text-dark-400">Configure AI moderation and room rules</p>
            </div>

            {/* AI Settings */}
            <div className="bg-gradient-to-br from-primary-500/5 to-accent-500/5 border border-primary-500/20 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Brain className="w-6 h-6 text-primary-400" />
                <h3 className="font-semibold text-white">AI Moderation</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-white">AI Moderation</h4>
                    <p className="text-sm text-dark-400">Automatically detect harmful content</p>
                  </div>
                  <button
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      settings: { ...prev.settings, aiModeration: !prev.settings.aiModeration }
                    }))}
                    className={cn(
                      'w-12 h-6 rounded-full transition-colors relative',
                      formData.settings.aiModeration ? 'bg-primary-500' : 'bg-dark-700'
                    )}
                  >
                    <div className={cn(
                      'w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform',
                      formData.settings.aiModeration ? 'translate-x-6' : 'translate-x-0.5'
                    )} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-white">Fact Checking</h4>
                    <p className="text-sm text-dark-400">Verify claims with RAG-based checking</p>
                  </div>
                  <button
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      settings: { ...prev.settings, factChecking: !prev.settings.factChecking }
                    }))}
                    className={cn(
                      'w-12 h-6 rounded-full transition-colors relative',
                      formData.settings.factChecking ? 'bg-primary-500' : 'bg-dark-700'
                    )}
                  >
                    <div className={cn(
                      'w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform',
                      formData.settings.factChecking ? 'translate-x-6' : 'translate-x-0.5'
                    )} />
                  </button>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-white">Toxicity Threshold</h4>
                    <span className="text-primary-400 font-medium">{Math.round(formData.settings.toxicityThreshold * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="0.9"
                    step="0.1"
                    value={formData.settings.toxicityThreshold}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      settings: { ...prev.settings, toxicityThreshold: parseFloat(e.target.value) }
                    }))}
                    className="w-full accent-primary-500"
                  />
                  <div className="flex justify-between text-xs text-dark-400 mt-1">
                    <span>Strict (30%)</span>
                    <span>Lenient (90%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Room Settings */}
            <div className="space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5" />
                Room Settings
              </h3>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Max Participants
                </label>
                <input
                  type="number"
                  min="2"
                  max="500"
                  value={formData.maxParticipants}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxParticipants: parseInt(e.target.value) || 50 }))}
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                />
              </div>
            </div>

            {/* Rules */}
            <div>
              <h3 className="font-semibold text-white flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5" />
                Room Rules
              </h3>

              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={formData.newRule}
                  onChange={(e) => setFormData(prev => ({ ...prev, newRule: e.target.value }))}
                  placeholder="Add a rule..."
                  className="flex-1 bg-dark-800 border border-dark-700 rounded-xl px-4 py-2 text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRule())}
                />
                <Button onClick={addRule} variant="secondary" icon={Plus} disabled={!formData.newRule.trim()}>
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {formData.rules.map((rule, index) => (
                  <div key={index} className="flex items-center gap-2 bg-dark-800/50 rounded-lg px-4 py-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="flex-1 text-dark-300">{rule}</span>
                    <button onClick={() => removeRule(index)} className="text-dark-500 hover:text-red-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white">Review & Create</h2>
              <p className="text-dark-400">Make sure everything looks good</p>
            </div>

            {/* Summary */}
            <div className="space-y-4">
              <div className="bg-dark-800/50 rounded-xl p-4">
                <h4 className="text-sm font-medium text-dark-400 mb-1">Room Name</h4>
                <p className="text-white font-medium">{formData.name}</p>
              </div>

              {formData.topic && (
                <div className="bg-dark-800/50 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-dark-400 mb-1">Topic</h4>
                  <p className="text-white">{formData.topic}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-dark-800/50 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-dark-400 mb-1">Category</h4>
                  <p className="text-white flex items-center gap-2">
                    <span>{categories.find(c => c.value === formData.category)?.icon}</span>
                    {categories.find(c => c.value === formData.category)?.label}
                  </p>
                </div>

                <div className="bg-dark-800/50 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-dark-400 mb-1">Privacy</h4>
                  <p className="text-white flex items-center gap-2">
                    {formData.isPrivate ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                    {formData.isPrivate ? 'Private' : 'Public'}
                  </p>
                </div>
              </div>

              <div className="bg-dark-800/50 rounded-xl p-4">
                <h4 className="text-sm font-medium text-dark-400 mb-2">AI Features</h4>
                <div className="flex flex-wrap gap-2">
                  {formData.settings.aiModeration && (
                    <Badge variant="success" icon={Sparkles}>AI Moderation</Badge>
                  )}
                  {formData.settings.factChecking && (
                    <Badge variant="info" icon={Zap}>Fact Checking</Badge>
                  )}
                  <Badge variant="warning" icon={AlertTriangle}>
                    Toxicity: {Math.round(formData.settings.toxicityThreshold * 100)}%
                  </Badge>
                </div>
              </div>

              {formData.rules.length > 0 && (
                <div className="bg-dark-800/50 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-dark-400 mb-2">Rules ({formData.rules.length})</h4>
                  <ul className="space-y-1">
                    {formData.rules.map((rule, i) => (
                      <li key={i} className="flex items-center gap-2 text-dark-300 text-sm">
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-primary-400 mt-0.5" />
              <div className="text-sm text-dark-300">
                <p className="font-medium text-primary-400 mb-1">Ready to start</p>
                <p>Your room will be created and you'll be redirected to start the debate.</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-dark-800">
          <Button
            variant="ghost"
            onClick={prevStep}
            disabled={step === 1}
            icon={ArrowLeft}
          >
            Previous
          </Button>

          {step < 4 ? (
            <Button onClick={nextStep} icon={ArrowRight} iconPosition="right">
              Continue
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              loading={createRoomMutation.isPending}
              icon={Sparkles}
            >
              Create Room
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default CreateRoom;
