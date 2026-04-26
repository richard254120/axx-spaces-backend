import express from 'express';
import auth from '../middleware/auth.js';
import Property from '../models/Property.js';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

const router = express.Router();

// Cloudinary Config with logging
console.log("=== CLOUDINARY CONFIG ===");
console.log("CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME ? "✅ Loaded" : "❌ MISSING");
console.log("API_KEY:", process.env.CLOUDINARY_API_KEY ? "✅ Loaded" : "❌ MISSING");
console.log("API_SECRET:", process.env.CLOUDINARY_API_SECRET ? "✅ Loaded" : "❌ MISSING");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

// Main Upload Route
router.post('/', auth, upload.array('images', 6), async (req, res) => {
  console.log("Upload request started...");
  console.log("Number of files received:", req.files ? req.files.length : 0);
  console.log("Request body:", req.body);

  try {
    if (!req.files || req.files.length === 0) {
      console.log("No files received");
      return res.status(400).json({ error: "Please upload at least one image" });
    }

    console.log("Starting Cloudinary upload...");

    const uploadPromises = req.files.map((file, index) => {
      return new Promise((resolve, reject) => {
        console.log(`Uploading image ${index + 1}...`);
        cloudinary.uploader.upload_stream(
          { folder: "axx-spaces/properties" },
          (error, result) => {
            if (error) {
              console.error(`Cloudinary error for image ${index + 1}:`, error);
              reject(error);
            } else {
              console.log(`Image ${index + 1} uploaded successfully:`, result.secure_url);
              resolve(result.secure_url);
            }
          }
        ).end(file.buffer);
      });
    });

    const imageUrls = await Promise.all(uploadPromises);
    console.log("All images uploaded successfully:", imageUrls.length);

    const propertyData = {
      ...req.body,
      owner: req.user.id,
      images: imageUrls,
      status: 'pending'
    };

    // Convert numbers
    if (propertyData.price) propertyData.price = Number(propertyData.price);
    if (propertyData.deposit) propertyData.deposit = Number(propertyData.deposit);
    if (propertyData.bedrooms) propertyData.bedrooms = Number(propertyData.bedrooms);
    if (propertyData.bathrooms) propertyData.bathrooms = Number(propertyData.bathrooms);
    if (propertyData.lat) propertyData.lat = Number(propertyData.lat);
    if (propertyData.lng) propertyData.lng = Number(propertyData.lng);

    const property = new Property(propertyData);
    await property.save();

    console.log("Property saved to database successfully");

    res.status(201).json({
      message: `Property submitted with ${imageUrls.length} images`,
      property
    });
  } catch (err) {
    console.error("=== CRITICAL UPLOAD ERROR ===", err);
    res.status(500).json({ 
      error: "Upload failed",
      details: err.message,
      stack: err.stack 
    });
  }
});

// Other routes (keep them as they are)
router.get('/my-properties', auth, async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

router.get('/', async (req, res) => {
  try {
    const properties = await Property.find({ status: 'approved' }).sort({ createdAt: -1 });
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;