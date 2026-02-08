/**
 * Authentication Middleware
 * JWT token verification and user authentication
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret || !secret.trim()) {
    throw new Error('JWT_SECRET is required');
  }

  return secret;
};

/**
 * Authenticate JWT token from Authorization header
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.' 
      });
    }

    const decoded = jwt.verify(token, getJwtSecret());
    
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid token. User not found.' 
      });
    }

    if (user.status === 'banned') {
      return res.status(403).json({ 
        error: 'Your account has been banned.' 
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ 
        error: 'Your account is suspended.' 
      });
    }

    // Update last active
    user.lastActive = new Date();
    await user.save();

    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired. Please login again.' 
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token.' 
      });
    }
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      error: 'Authentication error.' 
    });
  }
};

/**
 * Check if user is admin
 */
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Access denied. Admin privileges required.' 
    });
  }
  next();
};

/**
 * Check if user is moderator or admin
 */
const isModerator = (req, res, next) => {
  if (!['moderator', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ 
      error: 'Access denied. Moderator privileges required.' 
    });
  }
  next();
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, getJwtSecret());
      const user = await User.findById(decoded.userId);
      if (user && user.status === 'active') {
        req.user = user;
        req.userId = user._id;
      }
    }
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

/**
 * Generate JWT tokens
 */
const generateTokens = (userId) => {
  const jwtSecret = getJwtSecret();

  const accessToken = jwt.sign(
    { userId },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    jwtSecret,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
  );

  return { accessToken, refreshToken };
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, getJwtSecret());
    
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    const user = await User.findById(decoded.userId).select('+refreshToken');
    
    if (!user || user.refreshToken !== refreshToken) {
      throw new Error('Invalid refresh token');
    }

    return user;
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

module.exports = {
  authenticateToken,
  isAdmin,
  isModerator,
  optionalAuth,
  generateTokens,
  verifyRefreshToken
};
