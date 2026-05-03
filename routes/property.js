import express from 'express';
import Property from '../models/Property.js';
import auth from '../middleware/auth.js'; 
import upload from '../middleware/multer.js';

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   1. UPLOAD PROPERTY
═══════════════════════════════════════════════════════════════ */
router.post('/', upload.array('images', 5), async (req, res) => {
  try {
    console.log("📦 UPLOAD REQUEST RECEIVED");

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
      images: imageUrls,
      image: imageUrls.length > 0 ? imageUrls[0] : null,
      lat: req.body.lat ? Number(req.body.lat) : null,
      lng: req.body.lng ? Number(req.body.lng) : null,
      status: 'pending',
      bookingStatus: 'available' // ✅ NEW
    };

    if (req.user && req.user.id) {
      propertyData.owner = req.user.id;
    }

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
   2. GET ALL APPROVED LISTINGS (Hide booked properties)
═══════════════════════════════════════════════════════════════ */
router.get('/approved', async (req, res) => {
  try {
    const query = { 
      status: 'approved',
      bookingStatus: { $ne: 'booked' } // ✅ Hide booked properties
    };

    if (req.query.county) {
      query.county = req.query.county;
    }

    if (req.query.area) {
      query.area = new RegExp(req.query.area, 'i');
    }

    if (req.query.type) {
      query.type = req.query.type;
    }

    if (req.query.price) {
      query.price = { $lte: Number(req.query.price) };
    }

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
   3. GET LANDLORD'S PROPERTIES (All statuses)
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
   4. GET LANDLORD'S AVAILABLE PROPERTIES (for booking tab)
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
   8. ✅ REQUEST BOOKING (Tenant submits booking request)
   POST /properties/:id/request-booking
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

    // Check if property is available
    if (property.bookingStatus !== 'available') {
      return res.status(400).json({ error: 'Property is not available for booking' });
    }

    // Add booking request
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
    property.bookingStatus = 'pending_booking'; // ✅ Change status
    await property.save();

    console.log("✅ Booking request created for property:", property._id);

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
   9. ✅ ACCEPT BOOKING REQUEST (Landlord accepts)
   POST /properties/:id/accept-booking/:requestId
═══════════════════════════════════════════════════════════════ */
router.post('/:id/accept-booking/:requestId', auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Check ownership
    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized - not your property' });
    }

    // Find booking request
    const bookingRequest = property.bookingRequests.find(
      br => br._id.toString() === req.params.requestId
    );

    if (!bookingRequest) {
      return res.status(404).json({ error: 'Booking request not found' });
    }

    // Update booking request status
    bookingRequest.status = 'accepted';
    bookingRequest.respondedAt = new Date();

    // Set current booking
    property.currentBooking = {
      tenant: bookingRequest.tenant,
      tenantName: bookingRequest.tenantName,
      tenantPhone: bookingRequest.tenantPhone,
      tenantEmail: bookingRequest.tenantEmail,
      bookedAt: new Date(),
      expectedMoveInDate: bookingRequest.preferredMoveInDate
    };

    // Update property status
    property.bookingStatus = 'booked';
    await property.save();

    console.log("✅ Booking accepted for property:", property._id);

    res.json({
      message: 'Booking accepted successfully!',
      data: property
    });

  } catch (err) {
    console.error("❌ Accept booking error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   10. ✅ REJECT BOOKING REQUEST (Landlord rejects)
   POST /properties/:id/reject-booking/:requestId
═══════════════════════════════════════════════════════════════ */
router.post('/:id/reject-booking/:requestId', auth, async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Check ownership
    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized - not your property' });
    }

    // Find booking request
    const bookingRequest = property.bookingRequests.find(
      br => br._id.toString() === req.params.requestId
    );

    if (!bookingRequest) {
      return res.status(404).json({ error: 'Booking request not found' });
    }

    // Update booking request status
    bookingRequest.status = 'rejected';
    bookingRequest.respondedAt = new Date();
    bookingRequest.rejectionReason = rejectionReason || '';

    // If no other pending requests, set status back to available
    const pendingRequests = property.bookingRequests.filter(br => br.status === 'pending');
    if (pendingRequests.length === 0) {
      property.bookingStatus = 'available';
    }

    await property.save();

    console.log("✅ Booking rejected for property:", property._id);

    res.json({
      message: 'Booking rejected',
      data: property
    });

  } catch (err) {
    console.error("❌ Reject booking error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   11. ✅ MARK AS AVAILABLE (Landlord un-books property)
   POST /properties/:id/mark-available
═══════════════════════════════════════════════════════════════ */
router.post('/:id/mark-available', auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Check ownership
    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized - not your property' });
    }

    // Clear booking
    property.currentBooking = undefined;
    property.bookingStatus = 'available';
    property.bookingRequests = []; // Clear all requests

    await property.save();

    console.log("✅ Property marked as available:", property._id);

    res.json({
      message: 'Property marked as available',
      data: property
    });

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
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized - not your property' });
    }

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
   13. DELETE PROPERTY
═══════════════════════════════════════════════════════════════ */
router.delete('/:id', auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

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