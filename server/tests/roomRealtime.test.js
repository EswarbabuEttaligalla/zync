const test = require('node:test');
const assert = require('node:assert/strict');

const Room = require('../models/Room');
const Message = require('../models/Message');
const SpeakerRequest = require('../models/SpeakerRequest');
const realtime = require('../services/roomRealtimeService');

test('room role helpers distinguish owner, moderator, participant, and viewer', () => {
  const ownerId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const moderatorId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
  const participantId = 'cccccccccccccccccccccccc';
  const viewerId = 'dddddddddddddddddddddddd';

  const room = new Room({
    name: 'Room',
    description: 'Desc',
    topic: 'Topic',
    host: ownerId,
    moderators: [moderatorId],
    participants: [
      { user: ownerId, role: 'owner' },
      { user: moderatorId, role: 'moderator' },
      { user: participantId, role: 'participant' },
      { user: viewerId, role: 'viewer' },
    ],
  });

  assert.equal(room.getMemberRole(ownerId), 'owner');
  assert.equal(room.getMemberRole(moderatorId), 'moderator');
  assert.equal(room.getMemberRole(participantId), 'participant');
  assert.equal(room.getMemberRole(viewerId), 'viewer');
  assert.equal(room.canSendMessage(ownerId), true);
  assert.equal(room.canSendMessage(viewerId), false);
  assert.equal(room.canModerate(ownerId), true);
  assert.equal(room.canModerate(viewerId), false);
  assert.ok(realtime.REACTION_TYPES.includes('clap'));
});

test('message reactionCounts aggregates reaction totals', () => {
  const message = new Message({
    room: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    sender: 'bbbbbbbbbbbbbbbbbbbbbbbb',
    content: 'Hello',
    reactions: [
      { user: '1', type: 'agree' },
      { user: '2', type: 'agree' },
      { user: '3', type: 'clap' },
    ],
  });

  assert.deepEqual(message.reactionCounts, {
    agree: 2,
    clap: 1,
  });
});

test('room participant compaction removes duplicate entries for the same user', () => {
  const participantId = 'eeeeeeeeeeeeeeeeeeeeeeee';
  const room = new Room({
    name: 'Room',
    description: 'Desc',
    topic: 'Topic',
    host: 'ffffffffffffffffffffffff',
    participants: [
      { user: participantId, role: 'viewer', joinedAt: new Date('2025-01-01') },
      { user: participantId, role: 'participant', joinedAt: new Date('2025-01-02') },
    ],
  });

  room.compactParticipants();

  assert.equal(room.participants.length, 1);
  assert.equal(room.getMemberRole(participantId), 'participant');
  assert.equal(room.canSendMessage(participantId), true);
});

test('room state builder dedupes participants and online users', async () => {
  const userId = '111111111111111111111111';
  const room = new Room({
    name: 'Room',
    description: 'Desc',
    topic: 'Topic',
    host: '222222222222222222222222',
    participants: [
      { user: userId, role: 'viewer' },
      { user: userId, role: 'participant' },
    ],
  });

  room.populate = async () => room;

  const originalFind = Message.find;
  const originalGetPendingForRoom = SpeakerRequest.getPendingForRoom;
  Message.find = () => ({
    populate() { return this; },
    sort() { return this; },
    limit() { return Promise.resolve([]); },
  });
  SpeakerRequest.getPendingForRoom = async () => [];

  try {
    const state = await realtime.buildRoomState({
      room,
      userId,
      onlineUsers: [
        { id: userId, username: 'Member' },
        { id: userId, username: 'Member' },
      ],
      typingUsers: [
        { userId, username: 'Member' },
        { userId, username: 'Member' },
      ],
    });

    assert.equal(state.participants.length, 1);
    assert.equal(state.onlineUsers.length, 1);
    assert.equal(state.typingUsers.length, 1);
    assert.equal(state.room.role, 'participant');
  } finally {
    Message.find = originalFind;
    SpeakerRequest.getPendingForRoom = originalGetPendingForRoom;
  }
});
