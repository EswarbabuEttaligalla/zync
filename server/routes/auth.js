/**
 * Authentication Routes
 * User signup, login, logout, and token management
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateTokens, verifyRefreshToken, authenticateToken } = require('../middleware/auth');
const { registerValidation, loginValidation } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', registerValidation, asyncHandler(async (req, res) => {
  const { username, email, password, firstName, lastName } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { username }]
  });

  if (existingUser) {
    return res.status(400).json({
      error: existingUser.email === email 
        ? 'Email already registered' 
        : 'Username already taken'
    });
  }

  // Create new user
  const user = new User({
    username,
    email,
    password,
    profile: {
      firstName: firstName || '',
      lastName: lastName || ''
    }
  });

  await user.save();

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user._id);

  // Save refresh token
  user.refreshToken = refreshToken;
  await user.save();

  res.status(201).json({
    message: 'Registration successful',
    user: user.getPublicProfile(),
    accessToken,
    refreshToken
  });
}));

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return tokens
 * @access  Public
 */
router.post('/login', loginValidation, asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user and validate credentials
  const user = await User.findByCredentials(email, password);

  // Update last login
  user.lastLogin = new Date();
  user.lastActive = new Date();

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user._id);

  // Save refresh token
  user.refreshToken = refreshToken;
  await user.save();

  res.json({
    message: 'Login successful',
    user: user.getPublicProfile(),
    accessToken,
    refreshToken
  });
}));

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and invalidate refresh token
 * @access  Private
 */
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
  req.user.refreshToken = null;
  await req.user.save();

  res.json({ message: 'Logout successful' });
}));

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  const user = await verifyRefreshToken(refreshToken);

  // Generate new tokens
  const tokens = generateTokens(user._id);

  // Update refresh token
  user.refreshToken = tokens.refreshToken;
  await user.save();

  res.json({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken
  });
}));

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  res.json({
    user: req.user.getPublicProfile()
  });
}));

/**
 * @route   PUT /api/auth/password
 * @desc    Change password
 * @access  Private
 */
router.put('/password', authenticateToken, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ 
      error: 'Current and new password required' 
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ 
      error: 'New password must be at least 8 characters' 
    });
  }

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');

  // Verify current password
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  // Update password
  user.password = newPassword;
  user.refreshToken = null; // Invalidate all sessions
  await user.save();

  // Generate new tokens
  const { accessToken, refreshToken } = generateTokens(user._id);
  user.refreshToken = refreshToken;
  await user.save();

  res.json({
    message: 'Password updated successfully',
    accessToken,
    refreshToken
  });
}));

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  // Always return success to prevent email enumeration
  if (!user) {
    return res.json({ 
      message: 'If email exists, password reset instructions sent' 
    });
  }

  // Generate reset token (in production, send via email)
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  user.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  user.passwordResetExpires = Date.now() + 3600000; // 1 hour
  
  await user.save();

  // In production, send email with reset link
  // For development, return token directly
  if (process.env.NODE_ENV === 'development') {
    return res.json({
      message: 'Password reset token generated',
      resetToken // Remove in production!
    });
  }

  res.json({ 
    message: 'If email exists, password reset instructions sent' 
  });
}));

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ 
      error: 'Token and new password required' 
    });
  }

  const crypto = require('crypto');
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({ 
      error: 'Invalid or expired reset token' 
    });
  }

  // Update password
  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshToken = null;
  await user.save();

  res.json({ message: 'Password reset successful' });
}));

module.exports = router;
