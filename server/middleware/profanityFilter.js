const moderationService = require('../services/moderationService');

const attachProfanityFilter = (socket) => {
  socket.use((packet, next) => {
    const [eventName, payload] = packet;

    if (eventName !== 'message:send' || !payload || typeof payload.content !== 'string') {
      return next();
    }

    payload.moderation = moderationService.detectProfanity(payload.content);
    return next();
  });
};

module.exports = {
  attachProfanityFilter,
};