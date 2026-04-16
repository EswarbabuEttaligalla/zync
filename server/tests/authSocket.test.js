const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { loginValidation } = require('../middleware/validation');
const socketRuntime = require('../socket/socketRuntime');

const setEnv = (key, value) => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
};

const restoreEnv = (snapshot) => {
  Object.entries(snapshot).forEach(([key, value]) => setEnv(key, value));
};

const runValidation = async (middlewares, req) => {
  const response = {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };

  for (const middleware of middlewares) {
    if (typeof middleware.run === 'function') {
      // express-validator chain
      await middleware.run(req);
      continue;
    }

    let nextCalled = false;
    await new Promise((resolve, reject) => {
      const maybePromise = middleware(req, response, (err) => {
        if (err) {
          reject(err);
          return;
        }
        nextCalled = true;
        resolve();
      });

      Promise.resolve(maybePromise).then(() => {
        if (!nextCalled) resolve();
      }).catch(reject);
    });

    if (response.payload) break;
  }

  return { response };
};

test('login validation accepts email or username identifiers', async () => {
  const { response } = await runValidation(loginValidation, {
    body: {
      email: 'johndoe',
      password: 'Password1',
    },
    headers: { 'content-type': 'application/json' },
    method: 'POST',
    originalUrl: '/api/auth/login',
  });

  assert.equal(response.statusCode, null);
  assert.equal(response.payload, null);
});

test('generateTokens uses the configured access and refresh secrets', () => {
  const previousEnv = {
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN,
  };

  setEnv('JWT_SECRET', 'access-secret-test');
  setEnv('JWT_REFRESH_SECRET', 'refresh-secret-test');
  setEnv('JWT_EXPIRES_IN', '1h');
  setEnv('JWT_REFRESH_EXPIRES_IN', '2h');

  try {
    const { accessToken, refreshToken } = authMiddleware.generateTokens('user123');
    const accessPayload = jwt.verify(accessToken, 'access-secret-test');
    const refreshPayload = jwt.verify(refreshToken, 'refresh-secret-test');

    assert.equal(accessPayload.userId, 'user123');
    assert.equal(refreshPayload.userId, 'user123');
    assert.equal(refreshPayload.type, 'refresh');
  } finally {
    restoreEnv(previousEnv);
  }
});

test('verifyRefreshToken rejects mismatched stored refresh tokens', async () => {
  const previousEnv = {
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  };

  setEnv('JWT_SECRET', 'access-secret-test');
  setEnv('JWT_REFRESH_SECRET', 'refresh-secret-test');

  const originalFindById = User.findById;
  User.findById = () => ({
    select: async () => ({ refreshToken: 'stored-refresh-token' }),
  });

  try {
    const { refreshToken } = authMiddleware.generateTokens('user123');
    await assert.rejects(
      () => authMiddleware.verifyRefreshToken(refreshToken),
      /Invalid refresh token/
    );
  } finally {
    User.findById = originalFindById;
    restoreEnv(previousEnv);
  }
});

test('authenticateSocket accepts valid access tokens and rejects invalid tokens', async () => {
  const previousEnv = {
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  };

  setEnv('JWT_SECRET', 'socket-access-secret');
  setEnv('JWT_REFRESH_SECRET', 'socket-refresh-secret');

  const originalFindById = User.findById;
  User.findById = async () => ({
    _id: 'user123',
    status: 'active',
    username: 'tester',
  });

  try {
    const { accessToken } = authMiddleware.generateTokens('user123');
    const socket = {
      handshake: {
        auth: { token: accessToken },
        headers: {},
        address: '127.0.0.1',
      },
      conn: { remoteAddress: '127.0.0.1' },
    };

    let nextError;
    await socketRuntime.authenticateSocket(socket, (error) => {
      nextError = error;
    });

    assert.equal(nextError, undefined);
    assert.equal(socket.userId, 'user123');
    assert.equal(socket.user.username, 'tester');

    const invalidSocket = {
      handshake: {
        auth: { token: 'invalid-token' },
        headers: {},
        address: '127.0.0.1',
      },
      conn: { remoteAddress: '127.0.0.1' },
    };

    let invalidError = null;
    await socketRuntime.authenticateSocket(invalidSocket, (error) => {
      invalidError = error;
    });

    assert.ok(invalidError);
    assert.equal(invalidError.message, 'Invalid token');
  } finally {
    User.findById = originalFindById;
    restoreEnv(previousEnv);
  }
});
