const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Message = require('../models/Message');

const router = express.Router();

// Register user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Login user (simple, no JWT)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json({ user: { id: user._id, username: user.username } });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all users
router.get('/', async (req, res) => {
  try {
    const users = await User.find({}, 'username email');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete user and related messages
router.delete('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const requesterId = String(req.body?.requesterId || '');

    if (!userId || !requesterId) {
      return res.status(400).json({ error: 'userId and requesterId are required' });
    }

    if (String(userId) === requesterId) {
      return res.status(400).json({ error: 'Cannot delete your own account from chat list' });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await Message.deleteMany({
      $or: [
        { sender: userId },
        { receiver: userId },
      ],
    });

    await User.deleteOne({ _id: userId });

    return res.json({ success: true, deletedUserId: String(userId) });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;