import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import auth from '../middleware/auth.js';
import Property from '../models/Property.js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

// ✅ CLOUDINARY CONFIG
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ CLOUDINARY STORAGE SETUP
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'axx_spaces_properties',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    transformation: [{ width: 1200, height: 800, crop: 'limit' }] 
  },
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // Increased to 10MB for multiple photos
});

// POST - Upload Property (Multiple Images)
// Note: Frontend must use append('images', file) in a loop
router.post('/', auth, upload.array('images', 10), async (req, res) => {
  try {
    // Collect all uploaded image URLs from Cloudinary
    const imageUrls = req.files ? req.files.map(file => file.path) : [];

    const propertyData = {
      ...req.body,
      owner: req.user.id,
      images: imageUrls, // ✅ Matches the new array field in Property.js
      status: 'pending'
    };

    // Convert strings to Numbers for MongoDB
    const numericFields = ['price', 'deposit', 'bedrooms', 'bathrooms', 'lat', 'lng'];
    numericFields.forEach(field => {
      if (propertyData[field]) propertyData[field] = Number(propertyData[field]);
    });

    const property = new Property(propertyData);
    await property.save();

    res.status(201).json({
      message: 'Property submitted successfully with cloud images. Awaiting approval.',
      property
    });
  } catch (err) {
    console.error("Upload Error:", err);
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

    // Optional: Delete images from Cloudinary here if needed
    await property.deleteOne();
    res.json({ message: 'Property deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET - Public Approved Listings (Explicit Endpoint)
router.get('/approved', async (req, res) => {
  try {
    const properties = await Property.find({ status: 'approved' })
      .sort({ createdAt: -1 });
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET - Fallback Public Listings
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