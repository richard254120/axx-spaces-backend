import express from 'express';
import Property from '../models/Property.js';
import User from '../models/User.js';
import auth from '../middleware/auth.js'; 
import upload from '../middleware/multer.js';

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   1. UPLOAD PROPERTY (Landlord or Caretaker)
═══════════════════════════════════════════════════════════════ */
router.post('/', auth, upload.array('images', 5), async (req, res) => {
  try {
    console.log("📦 UPLOAD REQUEST");
    console.log("User ID:", req.user.id);

    const user = await User.findById(req.user.id);
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

    // ✅ NEW - Determine owner and uploader
    let owner = req.user.id;
    let uploadedBy = req.user.id;
    
    if (user.role === 'caretaker') {
      owner = user.assignedTo; // ✅ NEW - Caretaker uploads on behalf of landlord
      uploadedBy = req.user.id; // Track who uploaded
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
      images: imageUrls,
      image: imageUrls.length > 0 ? imageUrls[0] : null,
      lat: req.body.lat ? Number(req.body.lat) : null,
      lng: req.body.lng ? Number(req.body.lng) : null,
      owner: owner, // ✅ NEW
      uploadedBy: uploadedBy, // ✅ NEW - Track caretaker
      status: 'pending', // ✅ CHANGED - Starts as pending (not landlord_approved)
      approvals: {
        landlord: { approved: false, approvedAt: null },
        admin: { approved: false, approvedAt: null }
      }
    };

    const property = new Property(propertyData);
    await property.save();

    console.log("✅ Property saved:", property._id);

    res.status(201).json({
      message: "✔ Property uploaded. Awaiting landlord approval.",
      data: property
    });

  } catch (err) {
    console.error("❌ UPLOAD ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   ✅ NEW - LANDLORD APPROVES PROPERTY
   PATCH /api/properties/:id/landlord-approve
═══════════════════════════════════════════════════════════════ */
router.patch('/:id/landlord-approve', auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    // Check if user is the owner (landlord)
    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only the landlord can approve this property' });
    }

    // ✅ Update landlord approval
    property.approvals.landlord.approved = true;
    property.approvals.landlord.approvedAt = new Date();
    property.approvals.landlord.notes = req.body.notes || '';
    property.status = 'landlord_approved'; // ✅ NEW - Move to landlord_approved
    
    await property.save();

    res.json({ 
      message: '✅ Property approved by landlord. Awaiting admin approval.',
      data: property 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   ✅ NEW - LANDLORD REJECTS PROPERTY
   PATCH /api/properties/:id/landlord-reject
═══════════════════════════════════════════════════════════════ */
router.patch('/:id/landlord-reject', auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only the landlord can reject this property' });
    }

    property.status = 'rejected';
    property.approvals.landlord.approved = false;
    property.approvals.landlord.notes = req.body.notes || 'Rejected by landlord';
    
    await property.save();

    res.json({ 
      message: '✅ Property rejected. Caretaker notified.',
      data: property 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   2. GET ALL APPROVED LISTINGS (public - only admin_approved)
═══════════════════════════════════════════════════════════════ */
router.get('/approved', async (req, res) => {
  try {
    const query = { status: 'admin_approved' }; // ✅ CHANGED - Only admin approved

    if (req.query.county) query.county = req.query.county;
    if (req.query.area) query.area = new RegExp(req.query.area, 'i');
    if (req.query.type) query.type = req.query.type;
    if (req.query.price) query.price = { $lte: Number(req.query.price) };
    if (req.query.bedrooms) query.bedrooms = req.query.bedrooms;

    const properties = await Property.find(query).sort({ createdAt: -1 });

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
   3. GET LANDLORD'S PROPERTIES (all statuses)
═══════════════════════════════════════════════════════════════ */
router.get('/my-properties', auth, async (req, res) => {
  try {
    // ✅ NEW - Show all properties (pending, landlord_approved, admin_approved, rejected)
    const properties = await Property.find({ owner: req.user.id })
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });
    
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
   ✅ NEW - GET LANDLORD'S PENDING PROPERTIES
   GET /api/properties/pending-approval
═══════════════════════════════════════════════════════════════ */
router.get('/pending-approval', auth, async (req, res) => {
  try {
    const properties = await Property.find({ 
      owner: req.user.id,
      status: 'pending' // Only pending landlord approval
    })
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   4. GET SINGLE PROPERTY
═══════════════════════════════════════════════════════════════ */
router.get('/:id', async (req, res) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate('owner', 'name phone')
      .populate('uploadedBy', 'name email');
    
    if (!property) return res.status(404).json({ error: 'Property not found' });
    
    const fixedProperty = {
      ...property.toObject(),
      images: property.images?.length > 0 ? property.images : property.image ? [property.image] : []
    };
    
    res.json(fixedProperty);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   5. UPDATE PROPERTY (Landlord only)
═══════════════════════════════════════════════════════════════ */
router.patch('/:id', auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });
    if (property.owner.toString() !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

    const updateFields = ['title', 'county', 'area', 'price', 'deposit', 'type', 'bedrooms', 'bathrooms', 'amenities', 'description', 'phone', 'lat', 'lng'];
    updateFields.forEach(field => {
      if (req.body[field] !== undefined) property[field] = req.body[field];
    });

    await property.save();
    res.json(property);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   6. DELETE PROPERTY (Landlord only)
═══════════════════════════════════════════════════════════════ */
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