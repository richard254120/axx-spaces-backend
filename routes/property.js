import express from 'express';
import auth from '../middleware/auth.js';
import Property from '../models/Property.js';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ✅ GET APPROVED PROPERTIES (The fix for renter view)
router.get('/approved', async (req, res) => {
  try {
    const properties = await Property.find({ status: 'approved' }).sort({ createdAt: -1 });
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ POST NEW PROPERTY
router.post('/', auth, upload.array('images', 6), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Please upload at least one image" });
    }

    const uploadPromises = req.files.map((file) => {
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

    // Ensure numeric types
    const fields = ['price', 'deposit', 'bedrooms', 'bathrooms', 'lat', 'lng'];
    fields.forEach(field => {
      if (propertyData[field]) propertyData[field] = Number(propertyData[field]);
    });

    const property = new Property(propertyData);
    await property.save();
    res.status(201).json({ message: "Submitted for approval", property });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ DELETE PROPERTY
router.delete('/:id', auth, async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, owner: req.user.id });
    if (!property) return res.status(404).json({ error: 'Property not found' });
    await property.deleteOne();
    res.json({ message: 'Property deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;