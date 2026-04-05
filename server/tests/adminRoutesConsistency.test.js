const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin client paths match backend routes', () => {
  const apiPath = path.join(__dirname, '../../client/src/services/api.js');
  const adminRoutePath = path.join(__dirname, '../routes/admin.js');

  const apiText = fs.readFileSync(apiPath, 'utf8');
  const routeText = fs.readFileSync(adminRoutePath, 'utf8');

  const expectedPaths = [
    '/admin/stats',
    '/admin/users',
    '/admin/users/${userId}/status',
    '/admin/users/${userId}/role',
    '/admin/users/${userId}/ban',
    '/admin/users/${userId}/unban',
    '/admin/rooms',
    '/admin/moderation',
    '/admin/messages/flagged',
    '/admin/messages/${messageId}/approve',
    '/admin/messages/${messageId}',
    '/admin/messages/${messageId}/review',
    '/admin/analytics',
  ];

  const backendPaths = [
    '/stats',
    '/users',
    '/users/:userId/status',
    '/users/:userId/role',
    '/users/:userId/ban',
    '/users/:userId/unban',
    '/rooms',
    '/moderation',
    '/messages/flagged',
    '/messages/:messageId/approve',
    '/messages/:messageId',
    '/messages/:messageId/review',
    '/analytics',
  ];

  for (const expectedPath of expectedPaths) {
    assert.ok(apiText.includes(expectedPath), expectedPath);
  }

  for (const backendPath of backendPaths) {
    assert.ok(routeText.includes(backendPath), backendPath);
  }
});