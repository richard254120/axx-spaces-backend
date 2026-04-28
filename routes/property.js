import express from 'express';
import Property from '../models/Property.js';
import auth from '../middleware/auth.js'; 
import upload from '../middleware/multer.js';

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   1. UPLOAD PROPERTY (✅ ALREADY PERFECT - NO CHANGES)
═══════════════════════════════════════════════════════════════ */
router.post('/', auth, upload.array('images', 5), async (req, res) => {
  try {
    console.log("📦 UPLOAD REQUEST RECEIVED");
    console.log("User ID:", req.user.id);
    console.log("Files count:", req.files?.length || 0);

    const imageUrls = req.files ? req.files.map(file => file.path) : [];

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
      images: imageUrls,  // ✅ ARRAY - PERFECT
      image: imageUrls.length > 0 ? imageUrls[0] : null,
      lat: req.body.lat ? Number(req.body.lat) : null,
      lng: req.body.lng ? Number(req.body.lng) : null,
      status: 'pending',
      owner: req.user.id
    };

    const property = new Property(propertyData);
    await property.save();

    console.log("✅ SAVED with", property.images.length, "images:", property.images);

    res.status(201).json({
      message: "Property submitted ✔",
      data: property
    });

  } catch (err) {
    console.error("❌ UPLOAD ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   🔥 NEW! GET ALL PROPERTIES (for listings page)
═══════════════════════════════════════════════════════════════ */
router.get('/', async (req, res) => {
  try {
    const properties = await Property.find().populate('owner', 'name phone').sort({ createdAt: -1 });
    
    // ✅ FIX: Ensure images is always ARRAY
    const fixedProperties = properties.map(property => ({
      ...property.toObject(),
      images: property.images && property.images.length > 0 
        ? property.images 
        : property.image ? [property.image] : []
    }));

    console.log(`✅ Returning ${fixedProperties.length} properties`);
    console.log('Sample images:', fixedProperties[0]?.images);

    res.json(fixedProperties);
  } catch (err) {
    console.error("❌ GET PROPERTIES ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   2. GET ALL APPROVED LISTINGS (public)
═══════════════════════════════════════════════════════════════ */
router.get('/approved', async (req, res) => {
  try {
    const query = { status: 'approved' };

    if (req.query.county) query.county = req.query.county;
    if (req.query.area) query.area = new RegExp(req.query.area, 'i');
    if (req.query.type) query.type = req.query.type;
    if (req.query.price) query.price = { $lte: Number(req.query.price) };
    if (req.query.bedrooms) query.bedrooms = req.query.bedrooms;

    const properties = await Property.find(query).sort({ createdAt: -1 });

    // ✅ FIX: Ensure images array
    const fixedProperties = properties.map(p => ({
      ...p.toObject(),
      images: p.images?.length > 0 ? p.images : p.image ? [p.image] : []
    }));

    res.json(fixedProperties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   3. GET LANDLORD'S PROPERTIES (✅ NO CHANGE NEEDED)
═══════════════════════════════════════════════════════════════ */
router.get('/my-properties', auth, async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user.id }).sort({ createdAt: -1 });
    
    // ✅ FIX: Ensure images array
    const fixedProperties = properties.map(p => ({
      ...p.toObject(),
      images: p.images?.length > 0 ? p.images : p.image ? [p.image] : []
    }));
    
    res.json(fixedProperties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   4-6. SINGLE, UPDATE, DELETE (✅ NO CHANGES NEEDED)
═══════════════════════════════════════════════════════════════ */
router.get('/:id', async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });
    
    // ✅ FIX: Ensure images array for single property too
    const fixedProperty = {
      ...property.toObject(),
      images: property.images?.length > 0 ? property.images : property.image ? [property.image] : []
    };
    
    res.json(fixedProperty);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });
    if (property.owner.toString() !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

    const updateFields = ['title', 'county', 'area', 'price', 'deposit', 'type', 'bedrooms', 'bathrooms', 'amenities', 'description', 'phone', 'lat', 'lng', 'status'];
    updateFields.forEach(field => {
      if (req.body[field] !== undefined) property[field] = req.body[field];
    });

    await property.save();
    res.json(property);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });
    if (property.owner.toString() !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

    await property.deleteOne();
    res.json({ message: 'Property deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;