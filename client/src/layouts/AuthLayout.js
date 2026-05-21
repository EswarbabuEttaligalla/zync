import React from 'react';
import { Outlet, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Shield, Brain, MessageSquare, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const AuthLayout = () => {
  const { isAuthenticated } = useAuthStore();

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const features = [
    { icon: Shield, text: 'AI-powered moderation' },
    { icon: Brain, text: 'Intelligent fact-checking' },
    { icon: MessageSquare, text: 'Real-time debates' },
    { icon: CheckCircle2, text: 'Logical fallacy detection' },
  ];

  return (
    <div className="min-h-screen bg-dark-950 flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 animated-gradient" />
        
        {/* Mesh Overlay */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent-500/20 rounded-full blur-3xl" />
        </div>
        
        {/* Floating Particles */}
        <div className="particles">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="particle"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 20}s`,
                animationDuration: `${15 + Math.random() * 10}s`,
              }}
            />
          ))}
        </div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
              className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-lg border border-white/20 flex items-center justify-center"
            >
              <Zap className="w-7 h-7 text-white" />
            </motion.div>
            <span className="text-2xl font-bold">Zync</span>
          </Link>
          
          {/* Main Content */}
          <div className="max-w-lg">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-4xl xl:text-5xl font-bold leading-tight mb-6"
            >
              The Future of
              <br />
              <span className="gradient-text">Intelligent Debate</span>
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-lg text-white/70 mb-10"
            >
              Join the most advanced AI-moderated debate platform. Engage in meaningful discussions with real-time fact-checking and intelligent moderation.
            </motion.p>
            
            {/* Features */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="grid grid-cols-2 gap-4"
            >
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-lg rounded-xl border border-white/10"
                >
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                    <feature.icon className="w-5 h-5 text-primary-300" />
                  </div>
                  <span className="text-sm font-medium">{feature.text}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>
          
          {/* Bottom */}
            <div className="flex items-center gap-6 text-sm text-white/50">
              <span>© 2026 Zync</span>
              <button type="button" className="hover:text-white transition-colors">Privacy Policy</button>
              <button type="button" className="hover:text-white transition-colors">Terms of Service</button>
            </div>
        </div>
      </div>
      
      {/* Right Panel - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">
                AI<span className="text-primary-400">110</span>
              </span>
            </Link>
          </div>
          
          <Outlet />
        </motion.div>
      </div>
    </div>
  );
};

export default AuthLayout;
