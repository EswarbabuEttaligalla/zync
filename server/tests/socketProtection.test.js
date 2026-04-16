const test = require('node:test');
const assert = require('node:assert/strict');

const socketHandler = require('../socket/socketHandler');
const errorHandler = require('../middleware/errorHandler');

test('socket message rate limiting blocks bursts over the configured threshold', () => {
  const socket = { id: 'socket-rate-limit-test', userId: 'user-rate-limit-test' };

  let allowed = true;
  for (let i = 0; i < 8; i += 1) {
    allowed = socketHandler.checkMessageRateLimit(socket).allowed;
    assert.equal(allowed, true);
  }

  const blocked = socketHandler.checkMessageRateLimit(socket);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs >= 0);
});

test('socket slow mode blocks consecutive messages before the delay expires', () => {
  const first = socketHandler.checkSlowMode({
    roomId: 'room-slow-mode-test',
    userId: 'user-slow-mode-test',
    slowModeDelaySeconds: 10,
    now: 1000,
  });

  const second = socketHandler.checkSlowMode({
    roomId: 'room-slow-mode-test',
    userId: 'user-slow-mode-test',
    slowModeDelaySeconds: 10,
    now: 1500,
  });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);
  assert.ok(second.retryAfterMs > 0);
});

test('socket connection rate limiting uses the sliding window guard', () => {
  const socket = {
    handshake: { address: '127.0.0.1' },
    conn: { remoteAddress: '127.0.0.1' },
  };

  for (let i = 0; i < 12; i += 1) {
    assert.equal(socketHandler.checkConnectionRateLimit(socket).allowed, true);
  }

  const blocked = socketHandler.checkConnectionRateLimit(socket);
  assert.equal(blocked.allowed, false);
});

test('malformed JSON payloads return a stable 400 response', () => {
  const req = { originalUrl: '/api/messages/room-1' };
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  errorHandler({ type: 'entity.parse.failed' }, req, response, () => {});

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, 'Malformed JSON payload');
});