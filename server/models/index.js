/**
 * Models Index
 * Export all database models
 */

const User = require('./User');
const Room = require('./Room');
const Message = require('./Message');
const JoinRequest = require('./JoinRequest');
const ModerationLog = require('./ModerationLog');
const SpeakerRequest = require('./SpeakerRequest');
const Notification = require('./Notification');
const MuteRecord = require('./MuteRecord');
const RoomActivity = require('./RoomActivity');

module.exports = {
  User,
  Room,
  Message,
  JoinRequest,
  ModerationLog,
  SpeakerRequest,
  Notification,
  MuteRecord,
  RoomActivity,
};
