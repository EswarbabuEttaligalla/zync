const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const axios = require('axios');

const moderationService = require('../services/moderationService');
const Message = require('../models/Message');
const socketHandler = require('../socket/socketHandler');

test('blocked messages are excluded from visible room queries', () => {
  const query = Message.visibleQuery('room-123');

  assert.equal(query.room, 'room-123');
  assert.equal(query.isDeleted, false);
  assert.deepEqual(query.status.$nin.sort(), ['blocked', 'pending', 'pending_review'].sort());
});

test('unicode homoglyph and invisible separator profanity is blocked', () => {
  const homoglyph = moderationService.detectProfanity('𝖋𝖚𝖈𝖐');
  const invisible = moderationService.detectProfanity('f\u200bu\u200bc\u200bk');
  const spaced = moderationService.detectProfanity('f u c k');

  assert.equal(homoglyph.blocked, true);
  assert.equal(invisible.blocked, true);
  assert.equal(spaced.blocked, true);
});

test('flood control blocks repeated websocket sends', () => {
  const socket = { id: 'socket-spam-1', userId: 'user-spam-1' };

  for (let i = 0; i < 8; i += 1) {
    const result = socketHandler.checkMessageRateLimit(socket);
    assert.equal(result.allowed, true);
  }

  const blocked = socketHandler.checkMessageRateLimit(socket);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs >= 0);
});

test('connection spam is rate limited', () => {
  const socket = { handshake: { address: '203.0.113.10' }, conn: { remoteAddress: '203.0.113.10' } };

  for (let i = 0; i < 12; i += 1) {
    const result = socketHandler.checkConnectionRateLimit(socket);
    assert.equal(result.allowed, true);
  }

  const blocked = socketHandler.checkConnectionRateLimit(socket);
  assert.equal(blocked.allowed, false);
});

test('slow mode blocks immediate repeat messages', () => {
  const first = socketHandler.checkSlowMode({ roomId: 'room-slow-1', userId: 'user-slow-1', slowModeDelaySeconds: 5, now: 1000 });
  const second = socketHandler.checkSlowMode({ roomId: 'room-slow-1', userId: 'user-slow-1', slowModeDelaySeconds: 5, now: 2000 });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);
});

test('AI timeout fails open while keeping moderation logging intact', async (t) => {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
  };

  process.env.NODE_ENV = 'production';

  const originalPost = axios.post;
  axios.post = async () => {
    throw new Error('timeout');
  };

  t.after(() => {
    axios.post = originalPost;
    process.env.NODE_ENV = previousEnv.NODE_ENV;
  });

  const result = await moderationService.runAiModeration({
    content: 'test message',
    roomId: 'room-ai-1',
    userId: 'user-ai-1',
    timeout: 1,
    aiServerUrl: 'https://zync-backend-2hmu.onrender.com',
  });

  assert.equal(result.approved, true);
  assert.equal(result.pendingReview, false);
  assert.equal(result.aiUnavailable, true);
  assert.equal(result.degraded, true);
  assert.equal(result.status, 'degraded');
});

test('generic ai rejection falls back to pending review instead of blocking', async (t) => {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
  };

  process.env.NODE_ENV = 'production';

  const originalPost = axios.post;
  axios.post = async () => ({
    data: {
      approved: false,
      reason: 'Needs human review',
    },
  });

  t.after(() => {
    axios.post = originalPost;
    process.env.NODE_ENV = previousEnv.NODE_ENV;
  });

  const result = await moderationService.runAiModeration({
    content: 'hello world',
    roomId: 'room-ai-3',
    userId: 'user-ai-3',
    timeout: 1,
    aiServerUrl: 'https://zync-backend-2hmu.onrender.com',
  });

  assert.equal(result.approved, true);
  assert.equal(result.blocked, false);
  assert.equal(result.pendingReview, true);
  assert.equal(result.state, moderationService.MODERATION_STATES.PENDING_REVIEW);
  assert.equal(result.status, 'review_queued');
});

test('production local ai endpoint is treated as unavailable fallback', async (t) => {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
  };

  process.env.NODE_ENV = 'production';

  t.after(() => {
    process.env.NODE_ENV = previousEnv.NODE_ENV;
  });

  const result = await moderationService.runAiModeration({
    content: 'hello',
    roomId: 'room-ai-2',
    userId: 'user-ai-2',
    aiServerUrl: 'http://localhost:8000',
  });

  assert.equal(result.approved, true);
  assert.equal(result.aiUnavailable, true);
  assert.equal(result.degraded, true);
});

test('admin client uses backend moderation routes', () => {
  const apiSource = fs.readFileSync(path.join(__dirname, '../../client/src/services/api.js'), 'utf8');

  assert.match(apiSource, /getModeration:\s*\(\)\s*=>\s*api\.get\('\/admin\/moderation'\)/);
  assert.match(apiSource, /getFlaggedMessages:\s*\(\)\s*=>\s*api\.get\('\/admin\/messages\/flagged'\)/);
  assert.match(apiSource, /approveMessage:\s*\(messageId\)\s*=>\s*api\.put\(`\/admin\/messages\/\$\{messageId\}\/approve`\)/);
  assert.match(apiSource, /reviewMessage:\s*\(messageId, data\)\s*=>\s*api\.put\(`\/admin\/messages\/\$\{messageId\}\/review`, data\)/);
  assert.match(apiSource, /updateUserStatus:\s*\(userId, data\)\s*=>\s*api\.put\(`\/admin\/users\/\$\{userId\}\/status`, data\)/);
  assert.match(apiSource, /banUser:\s*\(userId\)\s*=>\s*api\.put\(`\/admin\/users\/\$\{userId\}\/ban`\)/);
  assert.match(apiSource, /unbanUser:\s*\(userId\)\s*=>\s*api\.put\(`\/admin\/users\/\$\{userId\}\/unban`\)/);
});