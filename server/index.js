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

const normalizeOrigin = (origin) => {
  if (!origin || typeof origin !== 'string') return null;

  try {
    return new URL(origin).origin;
  } catch (error) {
    return origin.trim().replace(/\/+$/, '');
  }
};

const parseOriginList = (...values) => Array.from(new Set(values.flatMap((value) => {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);
})));

const getAllowedOrigins = () => {
  const envOrigins = parseOriginList(
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    process.env.ALLOWED_ORIGINS,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  );

  return Array.from(new Set([
    'http://localhost:3000',
    'http://localhost:5173',
    ...envOrigins,
  ]));
};

const allowedOrigins = getAllowedOrigins();
const allowedOriginSet = new Set(allowedOrigins);
const allowedProductionOriginPattern = /^https:\/\/[a-z0-9-]+\.vercel\.(app|dev)$/i;

const isAllowedOrigin = (origin) => {
  const normalized = normalizeOrigin(origin);

  if (!normalized) {
    return true;
  }

  if (allowedOriginSet.has(normalized)) {
    return true;
  }

  if (process.env.NODE_ENV === 'production' && allowedProductionOriginPattern.test(normalized)) {
    return true;
  }

  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    console.warn('[cors] blocked origin', {
      origin: normalizeOrigin(origin),
      method: 'CORS',
      allowedOrigins,
    });

    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Socket.io setup with CORS
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      console.warn('[socket-cors] blocked origin', {
        origin: normalizeOrigin(origin),
        allowedOrigins,
      });

      return callback(null, false);
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingInterval: Number(process.env.SOCKET_PING_INTERVAL_MS || 25000),
  pingTimeout: Number(process.env.SOCKET_PING_TIMEOUT_MS || 20000),
  maxHttpBufferSize: Number(process.env.SOCKET_MAX_HTTP_BUFFER_SIZE || 1e6),
  perMessageDeflate: false,
});

// Security middleware
app.use(helmet());
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && !isAllowedOrigin(origin)) {
    console.warn('[cors] request origin not in allowlist', {
      origin: normalizeOrigin(origin),
      method: req.method,
      path: req.originalUrl,
    });
  }

  next();
});

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Rate limiting
app.set('trust proxy', 1);

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
const publicRoutes = require('./routes/public');
app.use('/api/public', publicRoutes);

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
