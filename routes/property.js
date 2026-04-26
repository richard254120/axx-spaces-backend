import express from 'express';
import auth from '../middleware/auth.js';
import Property from '../models/Property.js';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

const router = express.Router();

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer Setup - Memory Storage for Cloudinary
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per image
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// POST - Upload Property with Multiple Images
router.post('/', auth, upload.array('images', 6), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Please upload at least one image" });
    }

    // Upload images to Cloudinary
    const uploadPromises = req.files.map(file => {
      return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { folder: "axx-spaces/properties" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result.secure_url);
          }
        ).end(file.buffer);
      });
    });

    const imageUrls = await Promise.all(uploadPromises);

    const propertyData = {
      ...req.body,
      owner: req.user.id,
      images: imageUrls,
      status: 'pending'
    };

    // Convert numeric fields
    if (propertyData.price) propertyData.price = Number(propertyData.price);
    if (propertyData.deposit) propertyData.deposit = Number(propertyData.deposit);
    if (propertyData.bedrooms) propertyData.bedrooms = Number(propertyData.bedrooms);
    if (propertyData.bathrooms) propertyData.bathrooms = Number(propertyData.bathrooms);
    if (propertyData.lat) propertyData.lat = Number(propertyData.lat);
    if (propertyData.lng) propertyData.lng = Number(propertyData.lng);

    const property = new Property(propertyData);
    await property.save();

    res.status(201).json({
      message: `Property submitted successfully with ${imageUrls.length} images. Awaiting admin approval.`,
      property
    });
  } catch (err) {
    console.error("Upload Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET - My Properties
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

// GET - Public Approved Properties
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