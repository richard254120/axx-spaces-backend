import express from 'express';
import Property from '../models/Property.js';
import auth from '../middleware/auth.js'; 
import upload from '../middleware/multer.js';

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   1. CREATE PROPERTY - FULLY SECURED
═══════════════════════════════════════════════════════════════ */
router.post('/', auth, upload.array('images', 5), async (req, res) => {
  try {
    console.log("📦 Secured Upload Request Received");

    const allowedFields = [
      'title', 'county', 'area', 'price', 'deposit', 'type',
      'bedrooms', 'bathrooms', 'description', 'phone',
      'amenities', 'lat', 'lng', 'size', 'floor', 'yearBuilt',
      'furnishing', 'parking', 'petPolicy', 'utilitiesIncluded'
    ];

    const propertyData = {};

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        propertyData[field] = req.body[field];
      }
    });

    // Force Security Fields
    propertyData.owner = req.user.id;
    propertyData.status = 'pending';
    propertyData.bookingStatus = 'available';

    // Handle Images
    const imageUrls = req.files ? req.files.map(file => file.path) : [];
    propertyData.images = imageUrls;
    propertyData.image = imageUrls.length > 0 ? imageUrls[0] : null;

    // Amenities
    if (req.body.amenities) {
      try {
        propertyData.amenities = typeof req.body.amenities === 'string' 
          ? JSON.parse(req.body.amenities) 
          : req.body.amenities;
      } catch (e) {
        propertyData.amenities = [];
      }
    }

    const property = new Property(propertyData);
    await property.save();

    console.log("✅ Property saved securely:", property._id);

    res.status(201).json({
      message: "Property submitted for approval",
      data: property
    });

  } catch (err) {
    console.error("❌ Upload Error:", err);
    res.status(500).json({ error: err.message || "Failed to create property" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   2. GET ALL APPROVED LISTINGS
═══════════════════════════════════════════════════════════════ */
router.get('/approved', async (req, res) => {
  try {
    const query = { 
      status: 'approved',
      bookingStatus: { $ne: 'booked' }
    };

    if (req.query.county) query.county = req.query.county;
    if (req.query.area) query.area = new RegExp(req.query.area, 'i');
    if (req.query.type) query.type = req.query.type;
    if (req.query.price) query.price = { $lte: Number(req.query.price) };
    if (req.query.bedrooms) query.bedrooms = req.query.bedrooms;

    const properties = await Property.find(query).sort({ createdAt: -1 });
    res.json(properties);

  } catch (err) {
    console.error("❌ GET APPROVED ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   3. GET LANDLORD'S PROPERTIES
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
   4. GET LANDLORD'S AVAILABLE PROPERTIES
═══════════════════════════════════════════════════════════════ */
router.get('/my-available', auth, async (req, res) => {
  try {
    const properties = await Property.find({ 
      owner: req.user.id,
      bookingStatus: 'available'
    }).sort({ createdAt: -1 });
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   5. GET LANDLORD'S PENDING BOOKINGS
═══════════════════════════════════════════════════════════════ */
router.get('/my-pending', auth, async (req, res) => {
  try {
    const properties = await Property.find({ 
      owner: req.user.id,
      bookingStatus: 'pending_booking'
    })
    .populate('bookingRequests.tenant', 'name email')
    .sort({ createdAt: -1 });
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   6. GET LANDLORD'S BOOKED PROPERTIES
═══════════════════════════════════════════════════════════════ */
router.get('/my-booked', auth, async (req, res) => {
  try {
    const properties = await Property.find({ 
      owner: req.user.id,
      bookingStatus: 'booked'
    })
    .populate('currentBooking.tenant', 'name email phone')
    .sort({ createdAt: -1 });
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   7. GET SINGLE PROPERTY BY ID
═══════════════════════════════════════════════════════════════ */
router.get('/:id', async (req, res) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate('bookingRequests.tenant', 'name email phone')
      .populate('currentBooking.tenant', 'name email phone');
    
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json(property);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   8. REQUEST BOOKING
═══════════════════════════════════════════════════════════════ */
router.post('/:id/request-booking', auth, async (req, res) => {
  try {
    const { tenantName, tenantPhone, tenantEmail, preferredMoveInDate, requestMessage } = req.body;

    if (!tenantName || !tenantPhone || !tenantEmail) {
      return res.status(400).json({ error: 'Name, phone, and email required' });
    }

    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    if (property.bookingStatus !== 'available') {
      return res.status(400).json({ error: 'Property is not available for booking' });
    }

    const bookingRequest = {
      tenant: req.user.id,
      tenantName,
      tenantPhone,
      tenantEmail,
      preferredMoveInDate: new Date(preferredMoveInDate),
      requestMessage,
      status: 'pending',
      requestedAt: new Date()
    };

    property.bookingRequests.push(bookingRequest);
    property.bookingStatus = 'pending_booking';
    await property.save();

    res.status(201).json({
      message: 'Booking request sent successfully!',
      data: property
    });

  } catch (err) {
    console.error("❌ Booking request error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   9. ACCEPT BOOKING REQUEST
═══════════════════════════════════════════════════════════════ */
router.post('/:id/accept-booking/:requestId', auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const bookingRequest = property.bookingRequests.find(
      br => br._id.toString() === req.params.requestId
    );

    if (!bookingRequest) return res.status(404).json({ error: 'Booking request not found' });

    bookingRequest.status = 'accepted';
    bookingRequest.respondedAt = new Date();

    property.currentBooking = {
      tenant: bookingRequest.tenant,
      tenantName: bookingRequest.tenantName,
      tenantPhone: bookingRequest.tenantPhone,
      tenantEmail: bookingRequest.tenantEmail,
      bookedAt: new Date(),
      expectedMoveInDate: bookingRequest.preferredMoveInDate
    };

    property.bookingStatus = 'booked';
    await property.save();

    res.json({ message: 'Booking accepted successfully!', data: property });

  } catch (err) {
    console.error("❌ Accept booking error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   10. REJECT BOOKING REQUEST
═══════════════════════════════════════════════════════════════ */
router.post('/:id/reject-booking/:requestId', auth, async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const bookingRequest = property.bookingRequests.find(
      br => br._id.toString() === req.params.requestId
    );

    if (!bookingRequest) return res.status(404).json({ error: 'Booking request not found' });

    bookingRequest.status = 'rejected';
    bookingRequest.respondedAt = new Date();
    bookingRequest.rejectionReason = rejectionReason || '';

    const pendingRequests = property.bookingRequests.filter(br => br.status === 'pending');
    if (pendingRequests.length === 0) {
      property.bookingStatus = 'available';
    }

    await property.save();

    res.json({ message: 'Booking rejected', data: property });

  } catch (err) {
    console.error("❌ Reject booking error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   11. MARK PROPERTY AS AVAILABLE
═══════════════════════════════════════════════════════════════ */
router.post('/:id/mark-available', auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    property.currentBooking = undefined;
    property.bookingStatus = 'available';
    property.bookingRequests = [];

    await property.save();

    res.json({ message: 'Property marked as available', data: property });

  } catch (err) {
    console.error("❌ Mark available error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   12. UPDATE PROPERTY
═══════════════════════════════════════════════════════════════ */
router.patch('/:id', auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updateFields = [
      'title', 'county', 'area', 'price', 'deposit',
      'type', 'bedrooms', 'bathrooms', 'amenities',
      'description', 'phone', 'lat', 'lng'
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
   13. DELETE PROPERTY
═══════════════════════════════════════════════════════════════ */
router.delete('/:id', auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await property.deleteOne();
    res.json({ message: 'Property successfully deleted' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;