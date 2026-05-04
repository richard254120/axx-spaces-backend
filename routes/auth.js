import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// === REGISTER ===
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, role = 'landlord' } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) return res.status(400).json({ error: 'Email or Phone already exists' });

    const user = new User({ name, email, password, phone, role });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === LOGIN ===
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === INVITE CARETAKER ===
router.post('/invite-caretaker', auth, async (req, res) => {
  try {
    const { caretakerPhone, caretakerName } = req.body;
    const landlord = await User.findById(req.user.id);
    
    if (landlord.role !== 'landlord') return res.status(403).json({ error: 'Unauthorized' });

    let caretaker = await User.findOne({ phone: caretakerPhone });
    if (!caretaker) {
      caretaker = new User({
        name: caretakerName,
        phone: caretakerPhone,
        email: `caretaker_${caretakerPhone}@axxspaces.local`,
        password: await bcrypt.hash(Math.random().toString(36), 10),
        role: 'caretaker',
        assignedTo: landlord._id
      });
      await caretaker.save();
    }

    if (!landlord.caretakers.includes(caretaker._id)) {
      landlord.caretakers.push(caretaker._id);
      await landlord.save();
    }

    res.json({ message: '✅ Caretaker invited', caretaker });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === GET CARETAKERS ===
router.get('/my-caretakers', auth, async (req, res) => {
  try {
    const landlord = await User.findById(req.user.id).populate('caretakers', 'name phone role');
    res.json(landlord.caretakers || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;