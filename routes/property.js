import express from 'express';
import Property from '../models/Property.js';
import auth from '../middleware/auth.js'; 
import upload from '../middleware/multer.js';

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   1. UPLOAD PROPERTY (supports both auth & no-auth for now)
═══════════════════════════════════════════════════════════════ */
router.post('/', upload.array('images', 5), async (req, res) => {
  try {
    console.log("📦 UPLOAD REQUEST RECEIVED");
    console.log("Body:", req.body);
    console.log("Files:", req.files);

    // Extract Cloudinary URLs from uploaded files
    const imageUrls = req.files ? req.files.map(file => file.path) : [];

    // Parse amenities if it's a string
    let amenities = [];
    if (req.body.amenities) {
      try {
        amenities = typeof req.body.amenities === 'string' 
          ? JSON.parse(req.body.amenities) 
          : req.body.amenities;
      } catch (e) {
        amenities = [];
      }
    }

    // Build property data
    const propertyData = {
      title: req.body.title,
      county: req.body.county,
      area: req.body.area,
      price: Number(req.body.price),
      deposit: req.body.deposit ? Number(req.body.deposit) : null,
      type: req.body.type,
      bedrooms: req.body.bedrooms,
      bathrooms: req.body.bathrooms,
      amenities: amenities,
      description: req.body.description,
      phone: req.body.phone,
      // ✅ Store URLs from Cloudinary
      images: imageUrls,
      // ✅ Also save first image as single 'image' field for backward compat
      image: imageUrls.length > 0 ? imageUrls[0] : null,
      lat: req.body.lat ? Number(req.body.lat) : null,
      lng: req.body.lng ? Number(req.body.lng) : null,
      status: 'pending'
    };

    // If authenticated, add owner
    if (req.user && req.user.id) {
      propertyData.owner = req.user.id;
    }

    console.log("💾 Saving property:", propertyData);

    const property = new Property(propertyData);
    await property.save();

    console.log("✅ Property saved:", property._id);

    res.status(201).json({
      message: "Property submitted ✔",
      data: property
    });

  } catch (err) {
    console.error("❌ UPLOAD ERROR:", err);
    res.status(500).json({ 
      error: err.message,
      details: err.stack 
    });
  }
});

/* ═══════════════════════════════════════════════════════════════
   2. GET ALL APPROVED LISTINGS (for public browsing)
═══════════════════════════════════════════════════════════════ */
router.get('/approved', async (req, res) => {
  try {
    // ✅ Support filtering by query params
    const query = { status: 'approved' };

    // County filter
    if (req.query.county) {
      query.county = req.query.county;
    }

    // Area filter
    if (req.query.area) {
      query.area = new RegExp(req.query.area, 'i'); // Case-insensitive
    }

    // Type filter
    if (req.query.type) {
      query.type = req.query.type;
    }

    // Price range filter
    if (req.query.price) {
      query.price = { $lte: Number(req.query.price) };
    }

    // Bedrooms filter
    if (req.query.bedrooms) {
      query.bedrooms = req.query.bedrooms;
    }

    console.log("🔍 Approved listings query:", query);

    const properties = await Property.find(query).sort({ createdAt: -1 });

    console.log(`✅ Found ${properties.length} approved properties`);

    res.json(properties);

  } catch (err) {
    console.error("❌ GET APPROVED ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   3. GET LANDLORD'S PROPERTIES (requires auth)
═══════════════════════════════════════════════════════════════ */
router.get('/my-properties', auth, async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   4. GET SINGLE PROPERTY BY ID
═══════════════════════════════════════════════════════════════ */
router.get('/:id', async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json(property);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   5. UPDATE PROPERTY (requires auth & ownership)
═══════════════════════════════════════════════════════════════ */
router.patch('/:id', auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Check ownership
    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized - not your property' });
    }

    // Update allowed fields
    const updateFields = [
      'title', 'county', 'area', 'price', 'deposit',
      'type', 'bedrooms', 'bathrooms', 'amenities',
      'description', 'phone', 'lat', 'lng', 'status'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        property[field] = req.body[field];
      }
    });

    await property.save();
    res.json(property);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   6. DELETE PROPERTY (requires auth & ownership)
═══════════════════════════════════════════════════════════════ */
router.delete('/:id', auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Check ownership
    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized - not your property' });
    }

    await property.deleteOne();
    res.json({ message: 'Property successfully deleted' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;