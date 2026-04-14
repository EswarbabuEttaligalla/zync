const test = require('node:test');
const assert = require('node:assert/strict');
const RoomManager = require('../socket/RoomManager');

test('add and remove room member dedupes sockets per user', () => {
  const roomId = 'room-test';
  const userId = 'user-a';
  RoomManager.__internal.connectedUsers.clear();
  RoomManager.__internal.roomMembers.clear();

  RoomManager.setUserSession(userId, { id: 's1', emit: () => {}, user: { username: 'a' } });
  RoomManager.setUserSession(userId, { id: 's2', emit: () => {}, user: { username: 'a' } });
  assert.equal(RoomManager.getUserSessions(userId).sockets.size, 2);

  RoomManager.addRoomMember(roomId, userId, 's1');
  RoomManager.addRoomMember(roomId, userId, 's2');
  const members = RoomManager.__internal.roomMembers.get(roomId);
  assert.equal(members.get(userId).size, 2);

  RoomManager.removeRoomMember(roomId, userId, 's1');
  assert.equal(members.get(userId).size, 1);

  RoomManager.removeRoomMember(roomId, userId, 's2');
  assert.equal(RoomManager.__internal.roomMembers.get(roomId), undefined);
});

test('typing state set and clear', () => {
  const roomId = 'room-test2';
  RoomManager.setTyping(roomId, 'u1', 'Alice', true);
  assert.equal(RoomManager.getRoomTypingUsers(roomId).length, 1);
  RoomManager.setTyping(roomId, 'u1', 'Alice', false);
  assert.equal(RoomManager.getRoomTypingUsers(roomId).length, 0);
});

test('room online users are deduped by user id across multiple sockets', () => {
  const roomId = 'room-presence-test';
  const userId = 'user-presence-test';
  RoomManager.__internal.connectedUsers.clear();
  RoomManager.__internal.roomMembers.clear();

  RoomManager.setUserSession(userId, { id: 'socket-a', emit: () => {}, user: { username: 'Alice', profile: {} } });
  RoomManager.setUserSession(userId, { id: 'socket-b', emit: () => {}, user: { username: 'Alice', profile: {} } });
  RoomManager.addRoomMember(roomId, userId, 'socket-a');
  RoomManager.addRoomMember(roomId, userId, 'socket-b');

  const onlineUsers = RoomManager.getRoomOnlineUsers(roomId);
  assert.equal(onlineUsers.length, 1);
  assert.equal(onlineUsers[0].id, userId);
});
