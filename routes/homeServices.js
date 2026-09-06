const express = require('express');
const router = express.Router();
const multer = require('multer');
const HomeService = require('../models/HomeService');
const ServiceBooking = require('../models/ServiceBooking');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Helper function to upload images to Cloudinary
const uploadToCloudinary = async (buffer) => {
  try {
    const result = await require('cloudinary').v2.uploader.upload_stream(
      { resource_type: 'image', folder: 'home-services' },
      (error, result) => {
        if (error) throw error;
        return result;
      }
    ).end(buffer);
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Image upload failed');
  }
};

// @route   GET api/home-services
// @desc    Get all home services with filters
// @access  Public
router.get('/', async (req, res) => {
  try {
    const {
      category,
      location,
      minPrice,
      maxPrice,
      rating,
      verified,
      featured,
      search,
      page = 1,
      limit = 20
    } = req.query;

    const query = { status: 'active' };

    // Apply filters
    if (category) query.category = category;
    if (location) query['location.city'] = new RegExp(location, 'i');
    if (verified === 'true') query.verified = true;
    if (featured === 'true') query.featured = true;
    if (rating) query.rating = { $gte: parseFloat(rating) };
    if (minPrice || maxPrice) {
      query['pricing.baseRate'] = {};
      if (minPrice) query['pricing.baseRate'].$gte = parseFloat(minPrice);
      if (maxPrice) query['pricing.baseRate'].$lte = parseFloat(maxPrice);
    }
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { 'services.offered': new RegExp(search, 'i') }
      ];
    }

    const skip = (page - 1) * limit;
    const services = await HomeService.find(query)
      .sort({ featured: -1, rating: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await HomeService.countDocuments(query);

    res.json({
      services,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get home services error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/home-services/categories
// @desc    Get all home service categories
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const categories = await HomeService.distinct('category');
    const categoryCounts = await Promise.all(
      categories.map(async (cat) => ({
        name: cat,
        count: await HomeService.countDocuments({ category: cat, status: 'active' })
      }))
    );

    res.json(categoryCounts);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/home-services/:id
// @desc    Get single home service by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const service = await HomeService.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Increment view count
    service.views = (service.views || 0) + 1;
    await service.save();

    res.json(service);
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/home-services
// @desc    Create new home service
// @access  Private (Service Provider)
router.post('/', auth, upload.array('images', 5), [
  body('name').trim().notEmpty().withMessage('Service name is required'),
  body('category').isIn(['cleaning', 'plumbing', 'electrical', 'carpentry', 'painting', 'gardening', 'pest-control', 'hvac']).withMessage('Invalid category'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('location.city').trim().notEmpty().withMessage('City is required'),
  body('location.address').trim().notEmpty().withMessage('Address is required'),
  body('pricing.baseRate').isNumeric().withMessage('Base rate must be a number'),
  body('pricing.rateType').isIn(['hourly', 'fixed', 'per-room', 'per-sqft']).withMessage('Invalid rate type'),
  body('contact.phone').trim().notEmpty().withMessage('Phone number is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Upload images
    const imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const url = await uploadToCloudinary(file.buffer);
        imageUrls.push(url);
      }
    }

    const serviceData = {
      ...req.body,
      provider: req.user.id,
      images: imageUrls,
      services: {
        offered: req.body.servicesOffered ? req.body.servicesOffered.split(',').map(s => s.trim()) : [],
        specialties: req.body.specialties ? req.body.specialties.split(',').map(s => s.trim()) : []
      },
      availability: {
        hours: req.body.availabilityHours || '9:00 AM - 6:00 PM',
        days: req.body.availabilityDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      },
      pricing: {
        baseRate: parseFloat(req.body.pricing.baseRate),
        rateType: req.body.pricing.rateType,
        currency: req.body.pricing.currency || 'KES',
        additionalFees: req.body.additionalFees ? JSON.parse(req.body.additionalFees) : []
      },
      location: {
        city: req.body.location.city,
        address: req.body.location.address,
        coordinates: req.body.location.coordinates ? JSON.parse(req.body.location.coordinates) : null
      },
      contact: {
        phone: req.body.contact.phone,
        email: req.body.contact.email || req.user.email,
        whatsapp: req.body.contact.whatsapp
      },
      verification: {
        verified: false,
        documents: [],
        badges: []
      },
      stats: {
        views: 0,
        bookings: 0,
        completedJobs: 0,
        rating: 0,
        reviewCount: 0
      },
      status: 'pending'
    };

    const service = new HomeService(serviceData);
    await service.save();

    res.status(201).json(service);
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT api/home-services/:id
// @desc    Update home service
// @access  Private (Service Provider)
router.put('/:id', auth, upload.array('images', 5), async (req, res) => {
  try {
    const service = await HomeService.findById(req.params.id);

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    if (service.provider.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Handle image uploads
    if (req.files && req.files.length > 0) {
      const imageUrls = [];
      for (const file of req.files) {
        const url = await uploadToCloudinary(file.buffer);
        imageUrls.push(url);
      }
      service.images = [...(service.images || []), ...imageUrls];
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (key !== 'images' && req.body[key] !== undefined) {
        service[key] = req.body[key];
      }
    });

    await service.save();
    res.json(service);
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE api/home-services/:id
// @desc    Delete home service
// @access  Private (Service Provider)
router.delete('/:id', auth, async (req, res) => {
  try {
    const service = await HomeService.findById(req.params.id);

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    if (service.provider.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await service.deleteOne();
    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/home-services/:id/book
// @desc    Book a home service
// @access  Private
router.post('/:id/book', auth, [
  body('date').isISO8601().withMessage('Valid date is required'),
  body('time').trim().notEmpty().withMessage('Time is required'),
  body('address').trim().notEmpty().withMessage('Address is required'),
  body('description').trim().notEmpty().withMessage('Service description is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const service = await HomeService.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    if (service.status !== 'active') {
      return res.status(400).json({ message: 'Service is not available' });
    }

    const booking = new ServiceBooking({
      service: service._id,
      serviceType: 'home-service',
      customer: req.user.id,
      provider: service.provider,
      date: req.body.date,
      time: req.body.time,
      address: req.body.address,
      description: req.body.description,
      estimatedCost: service.pricing.baseRate,
      status: 'pending'
    });

    await booking.save();

    // Update service stats
    service.stats.bookings = (service.stats.bookings || 0) + 1;
    await service.save();

    res.status(201).json(booking);
  } catch (error) {
    console.error('Book service error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/home-services/provider/:providerId
// @desc    Get all services by a provider
// @access  Public
router.get('/provider/:providerId', async (req, res) => {
  try {
    const services = await HomeService.find({ 
      provider: req.params.providerId,
      status: 'active' 
    }).sort({ createdAt: -1 });

    res.json(services);
  } catch (error) {
    console.error('Get provider services error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/home-services/:id/review
// @desc    Add review to home service
// @access  Private
router.post('/:id/review', auth, [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('comment').trim().notEmpty().withMessage('Comment is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const service = await HomeService.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const review = {
      user: req.user.id,
      rating: parseInt(req.body.rating),
      comment: req.body.comment,
      createdAt: new Date()
    };

    service.reviews.push(review);

    // Update rating
    const totalRating = service.reviews.reduce((sum, r) => sum + r.rating, 0);
    service.stats.rating = totalRating / service.reviews.length;
    service.stats.reviewCount = service.reviews.length;

    await service.save();
    res.json(service);
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;