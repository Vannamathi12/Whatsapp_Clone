const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const Message = require('./models/Message');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

// MongoDB Connection
if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI is missing in backend/.env');
}

mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('MongoDB connected'))
.catch(err => console.log(err));

// Basic route
app.get('/', (req, res) => {
  res.send('WhatsApp Clone Backend');
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Socket.IO setup
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.set('io', io);

const onlineUserSocketCounts = new Map();
const lastSeenByUser = new Map();

const emitPresence = () => {
  const onlineUsers = Array.from(onlineUserSocketCounts.entries())
    .filter(([, count]) => count > 0)
    .map(([userId]) => userId);

  io.emit('presence:update', {
    onlineUsers,
    lastSeen: Object.fromEntries(lastSeenByUser),
  });
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    if (!userId) {
      return;
    }

    socket.join(String(userId));

    if (socket.data.userId !== String(userId)) {
      socket.data.userId = String(userId);
      onlineUserSocketCounts.set(
        String(userId),
        (onlineUserSocketCounts.get(String(userId)) || 0) + 1,
      );
      lastSeenByUser.delete(String(userId));
      emitPresence();
    }
  });

  socket.on('sendMessage', (data) => {
    if (!data?.receiver) {
      return;
    }

    socket.to(String(data.receiver)).emit('receiveMessage', data);
  });

  socket.on('typing', (data) => {
    if (!data?.to || !data?.from) {
      return;
    }

    const payload = {
      from: String(data.from),
      to: String(data.to),
      username: data.username || 'User',
    };

    // Broadcast and let clients filter by from/to so typing is resilient
    // even if a room join event is delayed or missed.
    io.emit('typing', payload);
  });

  socket.on('stopTyping', (data) => {
    if (!data?.to || !data?.from) {
      return;
    }

    io.emit('stopTyping', {
      from: String(data.from),
      to: String(data.to),
    });
  });

  socket.on('messageDelivered', async (data) => {
    try {
      const messageId = String(data?.messageId || '');
      const senderId = String(data?.senderId || '');

      if (!messageId || !senderId) {
        return;
      }

      const updated = await Message.findByIdAndUpdate(
        messageId,
        { status: 'delivered' },
        { new: true },
      );

      if (!updated) {
        return;
      }

      io.to(senderId).emit('messageStatusUpdated', {
        messageId,
        status: updated.status,
      });
    } catch (error) {
      console.error('messageDelivered error:', error.message);
    }
  });

  socket.on('messageRead', async (data) => {
    try {
      const messageId = String(data?.messageId || '');
      const senderId = String(data?.senderId || '');

      if (!messageId || !senderId) {
        return;
      }

      const updated = await Message.findByIdAndUpdate(
        messageId,
        { status: 'read' },
        { new: true },
      );

      if (!updated) {
        return;
      }

      io.to(senderId).emit('messageStatusUpdated', {
        messageId,
        status: updated.status,
      });
    } catch (error) {
      console.error('messageRead error:', error.message);
    }
  });

  socket.on('disconnect', () => {
    const userId = socket.data.userId;

    if (userId) {
      const nextCount = (onlineUserSocketCounts.get(userId) || 1) - 1;

      if (nextCount <= 0) {
        onlineUserSocketCounts.delete(userId);
        lastSeenByUser.set(userId, new Date().toISOString());
      } else {
        onlineUserSocketCounts.set(userId, nextCount);
      }

      emitPresence();
    }

    console.log('User disconnected:', socket.id);
  });
});

module.exports = app;