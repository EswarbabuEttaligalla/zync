const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');

// Public stats endpoint for landing page and marketing
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalUsers, activeUsers, totalRooms, totalMessages, flaggedMessages] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ lastActive: { $gte: weekAgo } }),
      Room.countDocuments(),
      Message.countDocuments(),
      Message.countDocuments({ 'moderation.toxicity.flagged': true }),
    ]);

    const uptimeSeconds = Math.floor(process.uptime() || 0);
    const toxicityBlockedPct = totalMessages > 0 ? Math.round((flaggedMessages / totalMessages) * 1000) / 10 : 0; // one decimal

    res.json({
      totalUsers,
      activeUsers,
      totalRooms,
      totalMessages,
      flaggedMessages,
      uptimeSeconds,
      toxicityBlockedPct,
    });
  } catch (err) {
    console.error('Public stats error', err);
    res.status(500).json({ error: 'Unable to retrieve public stats' });
  }
});

module.exports = router;
