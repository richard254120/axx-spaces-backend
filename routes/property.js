import express from 'express';
import Property from '../models/Property.js';
import auth from '../middleware/auth.js'; 
import upload from '../middleware/multer.js';

const router = express.Router();

// 1. UPLOAD PROPERTY
router.post('/', auth, upload.array('images', 5), async (req, res) => {
  try {
    const imageUrls = req.files.map(file => file.path);
    const propertyData = {
      ...req.body,
      owner: req.user.id, 
      images: imageUrls,
      status: 'pending'   
    };
    const property = new Property(propertyData);
    await property.save();
    res.status(201).json(property);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GET APPROVED LISTINGS
router.get('/approved', async (req, res) => {
  try {
    const properties = await Property.find({ status: 'approved' }).sort({ createdAt: -1 });
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. GET LANDLORD'S PROPERTIES
router.get('/my-properties', auth, async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. DELETE PROPERTY
router.delete('/:id', auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ msg: 'Not found' });
    if (property.owner.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Unauthorized action' });
    }
    await property.deleteOne();
    res.json({ msg: 'Property successfully deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🚨 THIS IS THE LINE NODE IS COMPLAINING ABOUT 🚨
// It must be at the very bottom of the file
export default router;