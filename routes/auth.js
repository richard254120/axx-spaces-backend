import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import auth from '../middleware/auth.js';

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   REGISTER (Landlord or Caretaker)
═══════════════════════════════════════════════════════════════ */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, role = 'landlord' } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email already exists' });

    const existingPhone = await User.findOne({ phone });
    if (existingPhone) return res.status(400).json({ error: 'Phone already registered' });

    const user = new User({ name, email, password, phone, role });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   LOGIN
═══════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════
   ✅ INVITE CARETAKER (by phone & name only)
   POST /api/auth/invite-caretaker
   Body: { caretakerPhone, caretakerName }
═══════════════════════════════════════════════════════════════ */
router.post('/invite-caretaker', auth, async (req, res) => {
  try {
    const { caretakerPhone, caretakerName } = req.body;
    
    if (!caretakerPhone || !caretakerName) {
      return res.status(400).json({ error: 'Phone and name required' });
    }

    const landlord = await User.findById(req.user.id);
    if (landlord.role !== 'landlord') {
      return res.status(403).json({ error: 'Only landlords can invite caretakers' });
    }

    // ✅ Check if caretaker already exists by phone
    let caretaker = await User.findOne({ phone: caretakerPhone });
    
    if (!caretaker) {
      // ✅ Create new caretaker (no email/password yet - they'll set when they upload)
      caretaker = new User({
        name: caretakerName,
        phone: caretakerPhone,
        email: `caretaker_${caretakerPhone}@axxspaces.local`, // Temp email
        password: Math.random().toString(36).slice(-12),
        role: 'caretaker',
        assignedTo: landlord._id
      });
      await caretaker.save();
    } else if (caretaker.role !== 'caretaker') {
      return res.status(400).json({ error: 'This phone is already registered as a different user type' });
    } else {
      // ✅ Update existing caretaker
      caretaker.assignedTo = landlord._id;
      await caretaker.save();
    }

    // ✅ Add to landlord's caretaker list
    if (!landlord.caretakers.includes(caretaker._id)) {
      landlord.caretakers.push(caretaker._id);
      await landlord.save();
    }

    res.json({ 
      message: '✅ Caretaker invited successfully',
      caretaker: { id: caretaker._id, name: caretaker.name, phone: caretaker.phone }
    });
  } catch (err) {
    console.error('❌ Invite error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET LANDLORD'S CARETAKERS
   GET /api/auth/my-caretakers
═══════════════════════════════════════════════════════════════ */
router.get('/my-caretakers', auth, async (req, res) => {
  try {
    const landlord = await User.findById(req.user.id).populate('caretakers', 'name phone role');
    if (landlord.role !== 'landlord') {
      return res.status(403).json({ error: 'Only landlords have caretakers' });
    }

    res.json(landlord.caretakers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   REMOVE CARETAKER
   DELETE /api/auth/remove-caretaker/:caretakerId
═══════════════════════════════════════════════════════════════ */
router.delete('/remove-caretaker/:caretakerId', auth, async (req, res) => {
  try {
    const landlord = await User.findById(req.user.id);
    if (landlord.role !== 'landlord') {
      return res.status(403).json({ error: 'Only landlords can remove caretakers' });
    }

    landlord.caretakers = landlord.caretakers.filter(id => id.toString() !== req.params.caretakerId);
    await landlord.save();

    await User.findByIdAndUpdate(req.params.caretakerId, { assignedTo: null });

    res.json({ message: '✅ Caretaker removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;