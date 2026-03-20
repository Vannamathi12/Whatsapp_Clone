const express = require('express');
const mongoose = require('mongoose');
const Message = require('../models/Message');

const router = express.Router();
const configuredRestoreWindowMs = Number.parseInt(process.env.MESSAGE_RESTORE_WINDOW_MS || '5000', 10);
const RESTORE_WINDOW_MS = Number.isInteger(configuredRestoreWindowMs)
  ? Math.min(Math.max(configuredRestoreWindowMs, 1000), 60000)
  : 5000;

// Get unread counts grouped by sender for a receiver.
router.get('/unread/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const results = await Message.aggregate([
      {
        $match: {
          receiver: new mongoose.Types.ObjectId(userId),
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

    const unreadBySender = results.reduce((acc, row) => {
      acc[String(row._id)] = row.count;
      return acc;
    }, {});

    return res.json({ unreadBySender });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// Mark all messages from sender to receiver as read.
router.patch('/read', async (req, res) => {
  try {
    const { receiverId, senderId } = req.body;

    if (!receiverId || !senderId) {
      return res.status(400).json({ error: 'receiverId and senderId are required' });
    }

    const result = await Message.updateMany(
      {
        sender: senderId,
        receiver: receiverId,
        status: { $ne: 'read' },
        isDeleted: { $ne: true },
      },
      {
        $set: { status: 'read' },
      },
    );

    return res.json({ updatedCount: result.modifiedCount || 0 });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// Send message
router.post('/', async (req, res) => {
  try {
    const { sender, receiver, content } = req.body;

    if (!sender || !receiver || !content || !content.trim()) {
      return res.status(400).json({ error: 'Sender, receiver, and content are required' });
    }

    const message = new Message({
      sender,
      receiver,
      content: content.trim(),
      status: 'sent',
    });
    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'username')
      .populate('receiver', 'username');

    const io = req.app.get('io');
    io.to(String(receiver)).emit('receiveMessage', populatedMessage);

    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages between two users
router.get('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { sender, limit, before } = req.query;

    if (!sender) {
      return res.status(400).json({ error: 'Sender query parameter is required' });
    }

    const baseQuery = {
      $or: [
        { sender, receiver: chatId },
        { sender: chatId, receiver: sender }
      ]
    };

    if (before) {
      const beforeDate = new Date(before);
      if (!Number.isNaN(beforeDate.getTime())) {
        baseQuery.timestamp = { $lt: beforeDate };
      }
    }

    const parsedLimit = Number.parseInt(limit, 10);
    const hasLimit = Number.isInteger(parsedLimit) && parsedLimit > 0;

    let query = Message.find(baseQuery)
      .populate('sender', 'username')
      .populate('receiver', 'username');

    if (hasLimit) {
      query = query.sort('-timestamp').limit(parsedLimit);
      const paged = await query;

      return res.json(paged.reverse());
    }

    const messages = await query.sort('timestamp');

    return res.json(messages);
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// Delete entire conversation for current user and the selected user.
router.delete('/conversation/:otherUserId', async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const currentUserId = String(req.body?.currentUserId || '');

    if (!otherUserId || !currentUserId) {
      return res.status(400).json({ error: 'otherUserId and currentUserId are required' });
    }

    const result = await Message.deleteMany({
      $or: [
        { sender: currentUserId, receiver: otherUserId },
        { sender: otherUserId, receiver: currentUserId },
      ],
    });

    return res.json({
      success: true,
      deletedCount: result.deletedCount || 0,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// Soft delete a message
router.delete('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.body;

    if (!messageId || !userId) {
      return res.status(400).json({ error: 'messageId and userId are required' });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const senderId = String(message.sender);
    const currentUserId = String(userId);

    if (senderId !== currentUserId) {
      return res.status(403).json({ error: 'Can only delete own messages' });
    }

    const deletedAt = new Date();

    await Message.updateOne(
      { _id: messageId },
      {
        $set: {
          isDeleted: true,
          deletedAt,
        },
      },
    );

    const io = req.app.get('io');
    const receiverId = String(message.receiver);

    io.to(currentUserId).emit('messageDeleted', {
      messageId,
      senderId: currentUserId,
      isDeleted: true,
      deletedAt: deletedAt.toISOString(),
      undoExpiresAt: new Date(deletedAt.getTime() + RESTORE_WINDOW_MS).toISOString(),
    });
    io.to(receiverId).emit('messageDeleted', {
      messageId,
      senderId: currentUserId,
      isDeleted: true,
      deletedAt: deletedAt.toISOString(),
      undoExpiresAt: new Date(deletedAt.getTime() + RESTORE_WINDOW_MS).toISOString(),
    });

    return res.json({
      success: true,
      messageId,
      deletedAt: deletedAt.toISOString(),
      undoExpiresAt: new Date(deletedAt.getTime() + RESTORE_WINDOW_MS).toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// Restore a soft-deleted message
router.post('/:messageId/restore', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.body;

    if (!messageId || !userId) {
      return res.status(400).json({ error: 'messageId and userId are required' });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const senderId = String(message.sender);
    const currentUserId = String(userId);

    if (senderId !== currentUserId) {
      return res.status(403).json({ error: 'Can only restore own messages' });
    }

    if (!message.isDeleted || !message.deletedAt) {
      return res.status(409).json({ error: 'Message is not eligible for restore' });
    }

    const deletedAtMs = new Date(message.deletedAt).getTime();
    const expiresAtMs = deletedAtMs + RESTORE_WINDOW_MS;

    if (Number.isNaN(deletedAtMs) || Date.now() > expiresAtMs) {
      return res.status(410).json({ error: 'Restore window has expired' });
    }

    await Message.updateOne(
      { _id: messageId },
      {
        $set: {
          isDeleted: false,
          deletedAt: null,
        },
      },
    );

    const io = req.app.get('io');
    const receiverId = String(message.receiver);

    io.to(currentUserId).emit('messageRestored', { messageId, senderId: currentUserId });
    io.to(receiverId).emit('messageRestored', { messageId, senderId: currentUserId });

    return res.json({ success: true, messageId });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;