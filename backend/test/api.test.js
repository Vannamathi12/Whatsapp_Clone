const express = require('express');
const request = require('supertest');

const createMessageModelMock = () => {
  const messageModelMock = jest.fn(function Message(doc) {
    Object.assign(this, doc);
    this._id = doc?._id || 'generated-message-id';
    this.save = jest.fn().mockResolvedValue(this);
  });

  messageModelMock.aggregate = jest.fn();
  messageModelMock.updateMany = jest.fn();
  messageModelMock.findById = jest.fn();
  messageModelMock.updateOne = jest.fn();
  messageModelMock.find = jest.fn();

  return messageModelMock;
};

const createMessagesApp = (messageModelMock, restoreWindowMs = '5000') => {
  process.env.MESSAGE_RESTORE_WINDOW_MS = restoreWindowMs;

  jest.resetModules();
  jest.doMock('../models/Message', () => messageModelMock);

  const routes = require('../routes/messages');
  const app = express();
  const emitMock = jest.fn();
  const io = {
    to: jest.fn(() => ({ emit: emitMock })),
  };

  app.use(express.json());
  app.set('io', io);
  app.use('/api/messages', routes);

  return { app, io, emitMock };
};

const createUserModelMock = () => {
  const userModelMock = jest.fn(function User(doc) {
    Object.assign(this, doc);
    this._id = doc?._id || 'generated-user-id';
    this.save = jest.fn().mockResolvedValue(this);
  });

  userModelMock.findOne = jest.fn();
  userModelMock.find = jest.fn();

  return userModelMock;
};

const createUsersApp = ({ userModelMock, bcryptMock } = {}) => {
  jest.resetModules();
  jest.doMock('../models/User', () => userModelMock);
  jest.doMock('bcryptjs', () => bcryptMock);

  const routes = require('../routes/users');
  const app = express();

  app.use(express.json());
  app.use('/api/users', routes);

  return { app };
};

afterEach(() => {
  delete process.env.MESSAGE_RESTORE_WINDOW_MS;
  jest.clearAllMocks();
  jest.resetModules();
});

describe('User Routes', () => {
  it('registers a new user with a hashed password', async () => {
    const userModelMock = createUserModelMock();
    const bcryptMock = {
      hash: jest.fn().mockResolvedValue('hashed-password'),
      compare: jest.fn(),
    };

    userModelMock.findOne.mockResolvedValue(null);

    const { app } = createUsersApp({ userModelMock, bcryptMock });

    const response = await request(app)
      .post('/api/users/register')
      .send({
        username: 'alice',
        email: 'alice@test.com',
        password: 'Password123',
      });

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({ message: 'User registered successfully' });
    expect(userModelMock.findOne).toHaveBeenCalledWith({
      $or: [{ username: 'alice' }, { email: 'alice@test.com' }],
    });
    expect(bcryptMock.hash).toHaveBeenCalledWith('Password123', 10);
    expect(userModelMock).toHaveBeenCalledWith({
      username: 'alice',
      email: 'alice@test.com',
      password: 'hashed-password',
    });
    expect(userModelMock.mock.instances[0].save).toHaveBeenCalledTimes(1);
  });

  it('rejects registration when required fields are missing', async () => {
    const userModelMock = createUserModelMock();
    const bcryptMock = {
      hash: jest.fn(),
      compare: jest.fn(),
    };

    const { app } = createUsersApp({ userModelMock, bcryptMock });

    const response = await request(app)
      .post('/api/users/register')
      .send({ username: 'alice' });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('All fields are required');
    expect(userModelMock.findOne).not.toHaveBeenCalled();
    expect(bcryptMock.hash).not.toHaveBeenCalled();
  });

  it('rejects registration when username or email already exists', async () => {
    const userModelMock = createUserModelMock();
    const bcryptMock = {
      hash: jest.fn(),
      compare: jest.fn(),
    };

    userModelMock.findOne.mockResolvedValue({ _id: 'existing-user-id' });

    const { app } = createUsersApp({ userModelMock, bcryptMock });

    const response = await request(app)
      .post('/api/users/register')
      .send({
        username: 'alice',
        email: 'alice@test.com',
        password: 'Password123',
      });

    expect(response.statusCode).toBe(409);
    expect(response.body.error).toBe('Username or email already exists');
    expect(bcryptMock.hash).not.toHaveBeenCalled();
  });

  it('logs in a user with valid credentials', async () => {
    const userModelMock = createUserModelMock();
    const bcryptMock = {
      hash: jest.fn(),
      compare: jest.fn().mockResolvedValue(true),
    };

    userModelMock.findOne.mockResolvedValue({
      _id: 'user-1',
      username: 'alice',
      password: 'hashed-password',
    });

    const { app } = createUsersApp({ userModelMock, bcryptMock });

    const response = await request(app)
      .post('/api/users/login')
      .send({ username: 'alice', password: 'Password123' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      user: { id: 'user-1', username: 'alice' },
    });
    expect(userModelMock.findOne).toHaveBeenCalledWith({ username: 'alice' });
    expect(bcryptMock.compare).toHaveBeenCalledWith('Password123', 'hashed-password');
  });

  it('rejects login with invalid credentials', async () => {
    const userModelMock = createUserModelMock();
    const bcryptMock = {
      hash: jest.fn(),
      compare: jest.fn().mockResolvedValue(false),
    };

    userModelMock.findOne.mockResolvedValue({
      _id: 'user-1',
      username: 'alice',
      password: 'hashed-password',
    });

    const { app } = createUsersApp({ userModelMock, bcryptMock });

    const response = await request(app)
      .post('/api/users/login')
      .send({ username: 'alice', password: 'wrong-password' });

    expect(response.statusCode).toBe(401);
    expect(response.body.error).toBe('Invalid credentials');
  });

  it('lists users with username and email fields', async () => {
    const userModelMock = createUserModelMock();
    const bcryptMock = {
      hash: jest.fn(),
      compare: jest.fn(),
    };
    const users = [
      { _id: 'u1', username: 'alice', email: 'alice@test.com' },
      { _id: 'u2', username: 'bob', email: 'bob@test.com' },
    ];

    userModelMock.find.mockResolvedValue(users);

    const { app } = createUsersApp({ userModelMock, bcryptMock });

    const response = await request(app)
      .get('/api/users');

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(users);
    expect(userModelMock.find).toHaveBeenCalledWith({}, 'username email');
  });
});

describe('Message Route Send + Fetch', () => {
  it('creates a message, trims content, and emits receiveMessage to the receiver', async () => {
    const messageModelMock = createMessageModelMock();
    const populatedMessage = {
      _id: 'm-send-1',
      sender: { _id: 'u1', username: 'Alice' },
      receiver: { _id: 'u2', username: 'Bob' },
      content: 'hello world',
      status: 'sent',
    };

    const populateReceiver = jest.fn().mockResolvedValue(populatedMessage);
    const populateSender = jest.fn(() => ({
      populate: populateReceiver,
    }));

    messageModelMock.findById.mockReturnValue({
      populate: populateSender,
    });

    const { app, io, emitMock } = createMessagesApp(messageModelMock, '5000');

    const response = await request(app)
      .post('/api/messages')
      .send({
        sender: 'u1',
        receiver: 'u2',
        content: '  hello world  ',
      });

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual(populatedMessage);
    expect(messageModelMock).toHaveBeenCalledWith({
      sender: 'u1',
      receiver: 'u2',
      content: 'hello world',
      status: 'sent',
    });
    expect(messageModelMock.mock.instances[0].save).toHaveBeenCalledTimes(1);
    expect(messageModelMock.findById).toHaveBeenCalledWith('generated-message-id');
    expect(io.to).toHaveBeenCalledWith('u2');
    expect(emitMock).toHaveBeenCalledWith('receiveMessage', populatedMessage);
  });

  it('rejects message creation when content is empty after trimming', async () => {
    const messageModelMock = createMessageModelMock();
    const { app } = createMessagesApp(messageModelMock, '5000');

    const response = await request(app)
      .post('/api/messages')
      .send({
        sender: 'u1',
        receiver: 'u2',
        content: '   ',
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('Sender, receiver, and content are required');
    expect(messageModelMock).not.toHaveBeenCalled();
    expect(messageModelMock.findById).not.toHaveBeenCalled();
  });

  it('rejects message creation when sender or receiver is missing', async () => {
    const messageModelMock = createMessageModelMock();
    const { app } = createMessagesApp(messageModelMock, '5000');

    const response = await request(app)
      .post('/api/messages')
      .send({
        sender: 'u1',
        content: 'hello',
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('Sender, receiver, and content are required');
    expect(messageModelMock).not.toHaveBeenCalled();
  });

  it('fetches paginated messages in chronological order and applies before filter', async () => {
    const messageModelMock = createMessageModelMock();
    const newerMessage = {
      _id: 'm3',
      content: 'newer',
      timestamp: '2026-03-19T10:02:00.000Z',
    };
    const olderMessage = {
      _id: 'm2',
      content: 'older',
      timestamp: '2026-03-19T10:01:00.000Z',
    };
    const limitMock = jest.fn().mockResolvedValue([newerMessage, olderMessage]);
    const sortMock = jest.fn(() => ({
      limit: limitMock,
    }));
    const queryMock = {
      populate: jest.fn().mockReturnThis(),
      sort: sortMock,
    };

    messageModelMock.find.mockReturnValue(queryMock);

    const { app } = createMessagesApp(messageModelMock, '5000');

    const response = await request(app)
      .get('/api/messages/u2?sender=u1&limit=2&before=2026-03-19T11:00:00.000Z');

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([olderMessage, newerMessage]);
    expect(messageModelMock.find).toHaveBeenCalledWith({
      $or: [
        { sender: 'u1', receiver: 'u2' },
        { sender: 'u2', receiver: 'u1' },
      ],
      timestamp: { $lt: new Date('2026-03-19T11:00:00.000Z') },
    });
    expect(sortMock).toHaveBeenCalledWith('-timestamp');
    expect(limitMock).toHaveBeenCalledWith(2);
  });

  it('fetches full history in ascending timestamp order when no limit is provided', async () => {
    const messageModelMock = createMessageModelMock();
    const messages = [
      { _id: 'm1', content: 'first' },
      { _id: 'm2', content: 'second' },
    ];
    const sortMock = jest.fn().mockResolvedValue(messages);
    const queryMock = {
      populate: jest.fn().mockReturnThis(),
      sort: sortMock,
    };

    messageModelMock.find.mockReturnValue(queryMock);

    const { app } = createMessagesApp(messageModelMock, '5000');

    const response = await request(app)
      .get('/api/messages/u2?sender=u1');

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(messages);
    expect(messageModelMock.find).toHaveBeenCalledWith({
      $or: [
        { sender: 'u1', receiver: 'u2' },
        { sender: 'u2', receiver: 'u1' },
      ],
    });
    expect(sortMock).toHaveBeenCalledWith('timestamp');
  });

  it('ignores an invalid before value and still returns history', async () => {
    const messageModelMock = createMessageModelMock();
    const messages = [{ _id: 'm1', content: 'first' }];
    const sortMock = jest.fn().mockResolvedValue(messages);
    const queryMock = {
      populate: jest.fn().mockReturnThis(),
      sort: sortMock,
    };

    messageModelMock.find.mockReturnValue(queryMock);

    const { app } = createMessagesApp(messageModelMock, '5000');

    const response = await request(app)
      .get('/api/messages/u2?sender=u1&before=not-a-date');

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(messages);
    expect(messageModelMock.find).toHaveBeenCalledWith({
      $or: [
        { sender: 'u1', receiver: 'u2' },
        { sender: 'u2', receiver: 'u1' },
      ],
    });
  });

  it('treats a non-positive limit as an unpaginated history request', async () => {
    const messageModelMock = createMessageModelMock();
    const messages = [{ _id: 'm1', content: 'first' }];
    const sortMock = jest.fn().mockResolvedValue(messages);
    const queryMock = {
      populate: jest.fn().mockReturnThis(),
      sort: sortMock,
    };

    messageModelMock.find.mockReturnValue(queryMock);

    const { app } = createMessagesApp(messageModelMock, '5000');

    const response = await request(app)
      .get('/api/messages/u2?sender=u1&limit=0');

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(messages);
    expect(sortMock).toHaveBeenCalledWith('timestamp');
  });
});

describe('Message Route Soft Delete + Restore', () => {
  it('soft deletes own message and returns restore metadata', async () => {
    const messageModelMock = createMessageModelMock();
    messageModelMock.findById.mockResolvedValue({
      _id: 'm1',
      sender: 'u1',
      receiver: 'u2',
      isDeleted: false,
      deletedAt: null,
    });
    messageModelMock.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const { app, io, emitMock } = createMessagesApp(messageModelMock, '5000');

    const response = await request(app)
      .delete('/api/messages/m1')
      .send({ userId: 'u1' });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.messageId).toBe('m1');
    expect(typeof response.body.deletedAt).toBe('string');
    expect(typeof response.body.undoExpiresAt).toBe('string');
    expect(new Date(response.body.undoExpiresAt).getTime()).toBeGreaterThan(new Date(response.body.deletedAt).getTime());

    expect(messageModelMock.updateOne).toHaveBeenCalledWith(
      { _id: 'm1' },
      {
        $set: {
          isDeleted: true,
          deletedAt: expect.any(Date),
        },
      },
    );

    expect(io.to).toHaveBeenCalledWith('u1');
    expect(io.to).toHaveBeenCalledWith('u2');
    expect(emitMock).toHaveBeenCalledWith(
      'messageDeleted',
      expect.objectContaining({
        messageId: 'm1',
        senderId: 'u1',
        isDeleted: true,
      }),
    );
  });

  it('rejects restore when message is not eligible', async () => {
    const messageModelMock = createMessageModelMock();
    messageModelMock.findById.mockResolvedValue({
      _id: 'm2',
      sender: 'u1',
      receiver: 'u2',
      isDeleted: false,
      deletedAt: null,
    });

    const { app } = createMessagesApp(messageModelMock, '5000');

    const response = await request(app)
      .post('/api/messages/m2/restore')
      .send({ userId: 'u1' });

    expect(response.statusCode).toBe(409);
    expect(response.body.error).toBe('Message is not eligible for restore');
    expect(messageModelMock.updateOne).not.toHaveBeenCalled();
  });

  it('rejects restore after window expiry', async () => {
    const messageModelMock = createMessageModelMock();
    messageModelMock.findById.mockResolvedValue({
      _id: 'm3',
      sender: 'u1',
      receiver: 'u2',
      isDeleted: true,
      deletedAt: new Date(Date.now() - 5000).toISOString(),
    });

    const { app } = createMessagesApp(messageModelMock, '1000');

    const response = await request(app)
      .post('/api/messages/m3/restore')
      .send({ userId: 'u1' });

    expect(response.statusCode).toBe(410);
    expect(response.body.error).toBe('Restore window has expired');
    expect(messageModelMock.updateOne).not.toHaveBeenCalled();
  });

  it('restores message within restore window', async () => {
    const messageModelMock = createMessageModelMock();
    messageModelMock.findById.mockResolvedValue({
      _id: 'm4',
      sender: 'u1',
      receiver: 'u2',
      isDeleted: true,
      deletedAt: new Date(Date.now() - 300).toISOString(),
    });
    messageModelMock.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const { app, io, emitMock } = createMessagesApp(messageModelMock, '5000');

    const response = await request(app)
      .post('/api/messages/m4/restore')
      .send({ userId: 'u1' });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.messageId).toBe('m4');

    expect(messageModelMock.updateOne).toHaveBeenCalledWith(
      { _id: 'm4' },
      {
        $set: {
          isDeleted: false,
          deletedAt: null,
        },
      },
    );

    expect(io.to).toHaveBeenCalledWith('u1');
    expect(io.to).toHaveBeenCalledWith('u2');
    expect(emitMock).toHaveBeenCalledWith(
      'messageRestored',
      expect.objectContaining({
        messageId: 'm4',
        senderId: 'u1',
      }),
    );
  });

  it('clamps restore window to max 60000ms when env is too large', async () => {
    const messageModelMock = createMessageModelMock();
    messageModelMock.findById.mockResolvedValue({
      _id: 'm5',
      sender: 'u1',
      receiver: 'u2',
      isDeleted: false,
      deletedAt: null,
    });
    messageModelMock.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const { app } = createMessagesApp(messageModelMock, '999999');

    const response = await request(app)
      .delete('/api/messages/m5')
      .send({ userId: 'u1' });

    expect(response.statusCode).toBe(200);

    const deletedAtMs = new Date(response.body.deletedAt).getTime();
    const undoExpiresAtMs = new Date(response.body.undoExpiresAt).getTime();

    expect(undoExpiresAtMs - deletedAtMs).toBe(60000);
  });

  it('clamps restore window to min 1000ms when env is too small', async () => {
    const messageModelMock = createMessageModelMock();
    messageModelMock.findById.mockResolvedValue({
      _id: 'm6',
      sender: 'u1',
      receiver: 'u2',
      isDeleted: false,
      deletedAt: null,
    });
    messageModelMock.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const { app } = createMessagesApp(messageModelMock, '100');

    const response = await request(app)
      .delete('/api/messages/m6')
      .send({ userId: 'u1' });

    expect(response.statusCode).toBe(200);

    const deletedAtMs = new Date(response.body.deletedAt).getTime();
    const undoExpiresAtMs = new Date(response.body.undoExpiresAt).getTime();

    expect(undoExpiresAtMs - deletedAtMs).toBe(1000);
  });

  it('rejects delete when user is not the message owner', async () => {
    const messageModelMock = createMessageModelMock();
    messageModelMock.findById.mockResolvedValue({
      _id: 'm7',
      sender: 'owner-1',
      receiver: 'u2',
      isDeleted: false,
      deletedAt: null,
    });

    const { app } = createMessagesApp(messageModelMock, '5000');

    const response = await request(app)
      .delete('/api/messages/m7')
      .send({ userId: 'different-user' });

    expect(response.statusCode).toBe(403);
    expect(response.body.error).toBe('Can only delete own messages');
    expect(messageModelMock.updateOne).not.toHaveBeenCalled();
  });

  it('rejects restore when user is not the message owner', async () => {
    const messageModelMock = createMessageModelMock();
    messageModelMock.findById.mockResolvedValue({
      _id: 'm8',
      sender: 'owner-1',
      receiver: 'u2',
      isDeleted: true,
      deletedAt: new Date(Date.now() - 200).toISOString(),
    });

    const { app } = createMessagesApp(messageModelMock, '5000');

    const response = await request(app)
      .post('/api/messages/m8/restore')
      .send({ userId: 'different-user' });

    expect(response.statusCode).toBe(403);
    expect(response.body.error).toBe('Can only restore own messages');
    expect(messageModelMock.updateOne).not.toHaveBeenCalled();
  });

  it('returns 404 when deleting a non-existent message', async () => {
    const messageModelMock = createMessageModelMock();
    messageModelMock.findById.mockResolvedValue(null);

    const { app } = createMessagesApp(messageModelMock, '5000');

    const response = await request(app)
      .delete('/api/messages/missing')
      .send({ userId: 'u1' });

    expect(response.statusCode).toBe(404);
    expect(response.body.error).toBe('Message not found');
    expect(messageModelMock.updateOne).not.toHaveBeenCalled();
  });

  it('returns 404 when restoring a non-existent message', async () => {
    const messageModelMock = createMessageModelMock();
    messageModelMock.findById.mockResolvedValue(null);

    const { app } = createMessagesApp(messageModelMock, '5000');

    const response = await request(app)
      .post('/api/messages/missing/restore')
      .send({ userId: 'u1' });

    expect(response.statusCode).toBe(404);
    expect(response.body.error).toBe('Message not found');
    expect(messageModelMock.updateOne).not.toHaveBeenCalled();
  });

  it('rejects delete when userId is missing', async () => {
    const messageModelMock = createMessageModelMock();
    const { app } = createMessagesApp(messageModelMock, '5000');

    const response = await request(app)
      .delete('/api/messages/missing')
      .send({});

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('messageId and userId are required');
    expect(messageModelMock.findById).not.toHaveBeenCalled();
  });

  it('rejects restore when userId is missing', async () => {
    const messageModelMock = createMessageModelMock();
    const { app } = createMessagesApp(messageModelMock, '5000');

    const response = await request(app)
      .post('/api/messages/missing/restore')
      .send({});

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('messageId and userId are required');
    expect(messageModelMock.findById).not.toHaveBeenCalled();
  });
});

describe('Message Route Unread + Read Filters', () => {
  it('rejects chat fetch when sender query parameter is missing', async () => {
    const messageModelMock = createMessageModelMock();
    const { app } = createMessagesApp(messageModelMock, '5000');

    const response = await request(app)
      .get('/api/messages/u2');

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('Sender query parameter is required');
    expect(messageModelMock.find).not.toHaveBeenCalled();
  });

  it('unread aggregation includes soft-delete filter', async () => {
    const messageModelMock = createMessageModelMock();
    const senderA = '64d9f4be2f6e2b001f5a1111';
    const senderB = '64d9f4be2f6e2b001f5a2222';
    const receiverId = '64d9f4be2f6e2b001f5a9999';

    messageModelMock.aggregate.mockResolvedValue([
      { _id: senderA, count: 3 },
      { _id: senderB, count: 1 },
    ]);

    const { app } = createMessagesApp(messageModelMock, '5000');

    const response = await request(app)
      .get(`/api/messages/unread/${receiverId}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      unreadBySender: {
        [senderA]: 3,
        [senderB]: 1,
      },
    });

    expect(messageModelMock.aggregate).toHaveBeenCalledTimes(1);
    expect(messageModelMock.aggregate).toHaveBeenCalledWith([
      {
        $match: {
          receiver: expect.any(Object),
          status: { $ne: 'read' },
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: '$sender',
          count: { $sum: 1 },
        },
      },
    ]);
  });

  it('rejects unread lookup when userId is not a valid ObjectId', async () => {
    const messageModelMock = createMessageModelMock();
    const { app } = createMessagesApp(messageModelMock, '5000');

    const response = await request(app)
      .get('/api/messages/unread/not-an-object-id');

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('Invalid userId');
    expect(messageModelMock.aggregate).not.toHaveBeenCalled();
  });

  it('mark-read updateMany includes soft-delete filter', async () => {
    const messageModelMock = createMessageModelMock();
    messageModelMock.updateMany.mockResolvedValue({ modifiedCount: 4 });

    const { app } = createMessagesApp(messageModelMock, '5000');

    const response = await request(app)
      .patch('/api/messages/read')
      .send({
        receiverId: '64d9f4be2f6e2b001f5a9999',
        senderId: '64d9f4be2f6e2b001f5a1111',
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ updatedCount: 4 });

    expect(messageModelMock.updateMany).toHaveBeenCalledWith(
      {
        sender: '64d9f4be2f6e2b001f5a1111',
        receiver: '64d9f4be2f6e2b001f5a9999',
        status: { $ne: 'read' },
        isDeleted: { $ne: true },
      },
      {
        $set: { status: 'read' },
      },
    );
  });

  it('rejects mark-read when receiverId or senderId is missing', async () => {
    const messageModelMock = createMessageModelMock();
    const { app } = createMessagesApp(messageModelMock, '5000');

    const response = await request(app)
      .patch('/api/messages/read')
      .send({ receiverId: 'only-receiver' });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('receiverId and senderId are required');
    expect(messageModelMock.updateMany).not.toHaveBeenCalled();
  });
});