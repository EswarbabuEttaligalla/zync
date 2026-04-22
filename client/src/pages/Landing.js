import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Zap,
  Shield,
  Brain,
  MessageSquare,
  Users,
  CheckCircle2,
  ArrowRight,
  Play,
  Star,
  TrendingUp,
  Globe,
  Lock,
  Sparkles,
  BarChart3,
  MessageCircle,
  Scale,
} from 'lucide-react';
import { Button, Badge } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import { publicAPI } from '../services/api';

const Landing = () => {
  const { isAuthenticated } = useAuthStore();

  const features = [
    {
      icon: Brain,
      title: 'AI-Powered Moderation',
      description: 'Advanced NLP models detect toxicity, hate speech, and personal attacks in real-time.',
      gradient: 'from-purple-500 to-indigo-500',
    },
    {
      icon: Scale,
      title: 'Fallacy Detection',
      description: 'Identifies logical fallacies like ad hominem, strawman, and false dilemmas instantly.',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: CheckCircle2,
      title: 'Fact-Checking RAG',
      description: 'Retrieval-augmented generation verifies claims against trusted knowledge bases.',
      gradient: 'from-emerald-500 to-teal-500',
    },
    {
      icon: MessageCircle,
      title: 'Real-Time Debates',
      description: 'Socket-powered instant messaging with typing indicators and reactions.',
      gradient: 'from-orange-500 to-red-500',
    },
    {
      icon: Shield,
      title: 'Safe Environment',
      description: 'Warnings, blocks, and rephrase suggestions keep discussions respectful.',
      gradient: 'from-pink-500 to-rose-500',
    },
    {
      icon: BarChart3,
      title: 'Analytics Dashboard',
      description: 'Track participation, view debate history, and monitor your progress.',
      gradient: 'from-amber-500 to-yellow-500',
    },
  ];

  const [stats, setStats] = useState([
    { value: '—', label: 'Active Debaters' },
    { value: '—', label: 'Debates Hosted' },
    { value: '—', label: 'Uptime' },
    { value: '—', label: 'Toxicity Blocked' },
  ]);

  useEffect(() => {
    let mounted = true;

    const fetchStats = async () => {
      try {
        const resp = await publicAPI.getPublicStats();
        const data = resp.data || {};

        const active = data.activeUsers ?? data.totalUsers ?? 0;
        const rooms = data.totalRooms ?? 0;
        const uptimeSeconds = data.uptimeSeconds ?? 0;
        const toxicityPct = data.toxicityBlockedPct ?? 0;

        const uptimeStr = (() => {
          if (!uptimeSeconds) return '—';
          const days = Math.floor(uptimeSeconds / 86400);
          const hours = Math.floor((uptimeSeconds % 86400) / 3600);
          if (days > 0) return `${days}d ${hours}h`;
          if (hours > 0) return `${hours}h`;
          const minutes = Math.floor((uptimeSeconds % 3600) / 60);
          return `${minutes}m`;
        })();

        if (!mounted) return;

        setStats([
          { value: active.toLocaleString(), label: 'Active Debaters' },
          { value: rooms.toLocaleString(), label: 'Debates Hosted' },
          { value: uptimeStr, label: 'Uptime' },
          { value: `${toxicityPct}%`, label: 'Toxicity Blocked' },
        ]);
      } catch (err) {
        // silently ignore; keep placeholders
      }
    };

    fetchStats();

    const interval = setInterval(fetchStats, 60 * 1000); // refresh every minute
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-dark-950 overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-950/80 backdrop-blur-xl border-b border-dark-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Zync</span>
            </Link>
            
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-dark-300 hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="text-dark-300 hover:text-white transition-colors">How it Works</a>
              <a href="#pricing" className="text-dark-300 hover:text-white transition-colors">Pricing</a>
            </div>
            
            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <Button as={Link} to="/dashboard" icon={ArrowRight} iconPosition="right">
                  Go to Dashboard
                </Button>
              ) : (
                <>
                  <Link to="/login" className="text-dark-300 hover:text-white transition-colors font-medium">
                    Sign In
                  </Link>
                  <Button as={Link} to="/register">
                    Get Started Free
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary-500/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-accent-500/15 rounded-full blur-[100px]" />
        </div>
        
        <div className="relative max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="primary" size="lg" className="mb-6" icon={Sparkles}>
              AI-Powered Debate Platform
            </Badge>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Debate Smarter with
              <br />
              <span className="gradient-text text-glow">AI Moderation</span>
            </h1>
            
            <p className="text-xl text-dark-300 max-w-2xl mx-auto mb-10">
              The world's first AI-moderated debate platform. Engage in meaningful discussions with real-time fact-checking, toxicity detection, and logical fallacy identification.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button as={Link} to="/register" size="xl" icon={ArrowRight} iconPosition="right">
                Start Debating Free
              </Button>
              <Button as="a" href="#demo" variant="secondary" size="xl" icon={Play}>
                Watch Demo
              </Button>
            </div>
          </motion.div>
          
          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8"
          >
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl font-bold gradient-text mb-2">{stat.value}</div>
                <div className="text-dark-400">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
        
        {/* Hero Image/Demo */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="relative max-w-6xl mx-auto mt-20"
        >
          <div className="relative bg-dark-900/50 border border-dark-800 rounded-2xl overflow-hidden shadow-2xl">
            {/* Fake Browser Chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-dark-800/50 border-b border-dark-700">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
              </div>
                  <div className="flex-1 mx-4">
                <div className="bg-dark-700 rounded-lg px-4 py-1.5 text-sm text-dark-400 max-w-xs mx-auto">
                  zync.debate/rooms/climate-change
                </div>
              </div>
            </div>
            
            {/* Demo Content */}
            <div className="p-6 lg:p-8">
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Chat Area */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Sample Messages */}
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-medium">
                      JD
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">John Doe</span>
                        <span className="text-xs text-dark-500">2 min ago</span>
                      </div>
                      <div className="bg-dark-800 rounded-2xl px-4 py-3 text-dark-200">
                        Climate change is primarily caused by human activities.
                      </div>
                    </div>
                  </div>
                  
                  {/* AI Fact Check */}
                  <div className="flex gap-3 ml-13">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-emerald-400">AI Fact Check</span>
                        <Badge variant="success" size="sm">Verified</Badge>
                      </div>
                      <p className="text-sm text-dark-300">
                        This claim is supported by IPCC reports and 97% scientific consensus.
                      </p>
                    </div>
                  </div>
                  
                  {/* Another message with warning */}
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium">
                      SA
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">Sarah A.</span>
                        <span className="text-xs text-dark-500">1 min ago</span>
                      </div>
                      <div className="bg-dark-800 border border-amber-500/30 rounded-2xl px-4 py-3">
                        <p className="text-dark-200">You're just saying that because you're biased!</p>
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-dark-700">
                          <Scale className="w-4 h-4 text-amber-400" />
                          <span className="text-xs text-amber-400">Ad Hominem fallacy detected</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Sidebar */}
                <div className="space-y-4">
                  <div className="bg-dark-800/50 rounded-xl p-4">
                    <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary-400" />
                      Online Now
                    </h4>
                    <div className="space-y-2">
                      {['John Doe', 'Sarah A.', 'Mike T.'].map((name, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="text-sm text-dark-300">{name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-dark-800/50 rounded-xl p-4">
                    <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary-400" />
                      AI Moderator
                    </h4>
                    <div className="flex items-center gap-2 text-emerald-400">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-sm">Active & Monitoring</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Glow Effect */}
          <div className="absolute -inset-4 bg-gradient-to-br from-primary-500/20 to-accent-500/20 rounded-3xl blur-3xl -z-10" />
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <Badge variant="primary" size="md" className="mb-4">Features</Badge>
            <h2 className="text-4xl font-bold text-white mb-4">
              Everything You Need for
              <br />
              <span className="gradient-text">Intelligent Debates</span>
            </h2>
            <p className="text-dark-400 max-w-2xl mx-auto">
              Powered by cutting-edge AI, our platform ensures every debate is productive, factual, and respectful.
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className="group relative bg-dark-900/50 border border-dark-800 p-6 rounded-2xl overflow-hidden"
              >
                <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full opacity-0 group-hover:opacity-100 blur-3xl transition-opacity duration-500 bg-gradient-to-br ${feature.gradient}`} />
                
                <div className="relative">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 bg-gradient-to-br ${feature.gradient}`}>
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  
                  <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-primary-400 transition-colors">
                    {feature.title}
                  </h3>
                  
                  <p className="text-dark-400 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center relative"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/20 to-accent-500/20 rounded-3xl blur-3xl" />
          
          <div className="relative bg-dark-900/50 border border-dark-800 rounded-3xl p-12">
            <h2 className="text-4xl font-bold text-white mb-4">
              Ready to Start Debating?
            </h2>
              <p className="text-dark-400 mb-8 max-w-xl mx-auto">
              Join thousands of users already using Zync for meaningful, fact-checked discussions.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button as={Link} to="/register" size="lg" icon={ArrowRight} iconPosition="right">
                Create Free Account
              </Button>
              <Button as={Link} to="/login" variant="secondary" size="lg">
                Sign In
              </Button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-dark-800 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Zync</span>
            </div>
            
            <div className="flex items-center gap-8 text-sm text-dark-400">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
              <a href="#" className="hover:text-white transition-colors">API</a>
            </div>
            
            <p className="text-sm text-dark-500">
              © 2026 Zync. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
