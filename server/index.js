/**
 * Zync — AI-Powered Debate Moderation Platform
 * Main Server Entry Point
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

// Import routes
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');

// Import socket handler
const { initializeSocket } = require('./socket/socketHandler');

// Import middleware
const { authenticateToken } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
  console.error('❌ JWT_SECRET is required. Refusing to start without a signing secret.');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

// Socket.io setup with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Body parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zync_debate');
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', authenticateToken, roomRoutes);
app.use('/api/messages', authenticateToken, messageRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'Zync Debate Moderator'
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize Socket.io
initializeSocket(io);

// Make io accessible to routes
app.set('io', io);

const PORT = process.env.PORT || 5000;

// Start server
const startServer = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`🚀 Zync Server running on port ${PORT}`);
    console.log(`📡 WebSocket server ready`);
    console.log(`🤖 AI Server expected at ${process.env.AI_SERVER_URL || 'http://localhost:8000'}`);
  });
};

startServer();

module.exports = { app, io };
