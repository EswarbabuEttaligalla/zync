const test = require('node:test');
const assert = require('node:assert/strict');

const Message = require('../models/Message');

test('visibleQuery excludes blocked and pending review messages', () => {
  const query = Message.visibleQuery('room-123');

  assert.equal(query.room, 'room-123');
  assert.equal(query.isDeleted, false);
  assert.deepEqual(query.status.$nin, ['blocked', 'pending', 'pending_review']);
});

test('visible query supports room history, search, and recent loads consistently', () => {
  const query = Message.visibleQuery('room-abc');

  assert.equal(query.room, 'room-abc');
  assert.equal(query.isDeleted, false);
  assert.equal(query.status.$nin.includes('blocked'), true);
  assert.equal(query.status.$nin.includes('pending_review'), true);
});