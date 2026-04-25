import express from 'express';
import multer from 'multer';
import path from 'path';
import auth from '../middleware/auth.js';
import Property from '../models/Property.js';

const router = express.Router();

// Multer Setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// POST - Upload Property
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const propertyData = {
      ...req.body,
      owner: req.user.id,
      image: req.file ? `/uploads/${req.file.filename}` : null,
      status: 'pending' // Initial status is pending
    };

    // Convert numbers (ensures MongoDB stores them as Numbers, not Strings)
    if (propertyData.price) propertyData.price = Number(propertyData.price);
    if (propertyData.deposit) propertyData.deposit = Number(propertyData.deposit);
    if (propertyData.bedrooms) propertyData.bedrooms = Number(propertyData.bedrooms);
    if (propertyData.bathrooms) propertyData.bathrooms = Number(propertyData.bathrooms);
    if (propertyData.lat) propertyData.lat = Number(propertyData.lat);
    if (propertyData.lng) propertyData.lng = Number(propertyData.lng);

    const property = new Property(propertyData);
    await property.save();

    res.status(201).json({
      message: 'Property submitted successfully. Awaiting admin approval.',
      property
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET - My Properties (For Landlord Dashboard)
router.get('/my-properties', auth, async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user.id })
      .sort({ createdAt: -1 });
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Delete Property
router.delete('/:id', auth, async (req, res) => {
  try {
    const property = await Property.findOne({ 
      _id: req.params.id, 
      owner: req.user.id 
    });

    if (!property) {
      return res.status(404).json({ error: 'Property not found or not yours' });
    }

    await property.deleteOne();
    res.json({ message: 'Property deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * ✅ FIX 1: MATCHING THE FRONTEND ENDPOINT
 * Your Listings.jsx calls API.get("/properties/approved")
 * This route now explicitly handles that request.
 */
router.get('/approved', async (req, res) => {
  try {
    // IMPORTANT: Ensure your Admin Panel sets status to exactly 'approved' (lowercase)
    const properties = await Property.find({ status: 'approved' })
      .sort({ createdAt: -1 });
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET - Public Listings (General fallback)
router.get('/', async (req, res) => {
  try {
    const properties = await Property.find({ status: 'approved' })
      .sort({ createdAt: -1 });
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;