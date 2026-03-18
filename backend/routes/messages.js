const express = require('express');
const Message = require('../models/Message');

const router = express.Router();

// Send message
router.post('/', async (req, res) => {
  try {
    const { sender, receiver, content } = req.body;
    if (!sender || !receiver || !content.trim()) {
      return res.status(400).json({ error: 'Sender, receiver, and content are required' });
    }
    const message = new Message({ sender, receiver, content });
    await message.save();
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages between two users
router.get('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    // Assuming chatId is receiver's ID, and sender is current user (from auth later)
    // For simplicity, get all messages where sender or receiver matches
    const messages = await Message.find({
      $or: [
        { sender: req.query.sender, receiver: chatId },
        { sender: chatId, receiver: req.query.sender }
      ]
    }).populate('sender', 'username').populate('receiver', 'username').sort('timestamp');
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;