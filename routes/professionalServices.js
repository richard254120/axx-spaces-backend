const express = require('express');
const router = express.Router();
const multer = require('multer');
const ProfessionalService = require('../models/ProfessionalService');
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
      { resource_type: 'image', folder: 'professional-services' },
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

// @route   GET api/professional-services
// @desc    Get all professional services with filters
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
      specialization,
      experience,
      page = 1,
      limit = 20
    } = req.query;

    const query = { status: 'active' };

    // Apply filters
    if (category) query.category = category;
    if (location) query['location.city'] = new RegExp(location, 'i');
    if (verified === 'true') query.verification.verified = true;
    if (featured === 'true') query.featured = true;
    if (rating) query['stats.rating'] = { $gte: parseFloat(rating) };
    if (experience) query['professionalInfo.experience'] = { $gte: parseInt(experience) };
    if (specialization) query.professionalInfo.specializations = new RegExp(specialization, 'i');
    if (minPrice || maxPrice) {
      query['pricing.hourlyRate'] = {};
      if (minPrice) query['pricing.hourlyRate'].$gte = parseFloat(minPrice);
      if (maxPrice) query['pricing.hourlyRate'].$lte = parseFloat(maxPrice);
    }
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { professionalInfo.specializations: new RegExp(search, 'i') },
        { 'businessInfo.companyName': new RegExp(search, 'i') }
      ];
    }

    const skip = (page - 1) * limit;
    const services = await ProfessionalService.find(query)
      .sort({ featured: -1, 'stats.rating': -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ProfessionalService.countDocuments(query);

    res.json({
      services,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get professional services error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/professional-services/categories
// @desc    Get all professional service categories
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const categories = await ProfessionalService.distinct('category');
    const categoryCounts = await Promise.all(
      categories.map(async (cat) => ({
        name: cat,
        count: await ProfessionalService.countDocuments({ category: cat, status: 'active' })
      }))
    );

    res.json(categoryCounts);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/professional-services/specializations
// @desc    Get all specializations
// @access  Public
router.get('/specializations', async (req, res) => {
  try {
    const { category } = req.query;
    const query = category ? { category, status: 'active' } : { status: 'active' };
    const services = await ProfessionalService.find(query).select('professionalInfo.specializations');
    
    const specializations = new Set();
    services.forEach(service => {
      service.professionalInfo.specializations.forEach(spec => {
        specializations.add(spec);
      });
    });

    res.json(Array.from(specializations));
  } catch (error) {
    console.error('Get specializations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/professional-services/:id
// @desc    Get single professional service by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const service = await ProfessionalService.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Increment view count
    service.stats.views = (service.stats.views || 0) + 1;
    await service.save();

    res.json(service);
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/professional-services
// @desc    Create new professional service
// @access  Private (Professional)
router.post('/', auth, upload.array('images', 5), [
  body('name').trim().notEmpty().withMessage('Professional name is required'),
  body('category').isIn(['legal', 'accounting', 'consulting', 'tutoring', 'medical', 'engineering', 'architecture', 'other']).withMessage('Invalid category'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('location.city').trim().notEmpty().withMessage('City is required'),
  body('pricing.hourlyRate').isNumeric().withMessage('Hourly rate must be a number'),
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
      professional: req.user.id,
      images: imageUrls,
      professionalInfo: {
        title: req.body.title || 'Professional',
        experience: parseInt(req.body.experience) || 0,
        specializations: req.body.specializations ? req.body.specializations.split(',').map(s => s.trim()) : [],
        education: req.body.education ? JSON.parse(req.body.education) : [],
        certifications: req.body.certifications ? JSON.parse(req.body.certifications) : [],
        languages: req.body.languages ? req.body.languages.split(',').map(s => s.trim()) : ['English']
      },
      businessInfo: {
        companyName: req.body.companyName,
        registrationNumber: req.body.registrationNumber,
        taxId: req.body.taxId,
        website: req.body.website,
        foundedYear: req.body.foundedYear ? parseInt(req.body.foundedYear) : null
      },
      services: {
        offered: req.body.servicesOffered ? req.body.servicesOffered.split(',').map(s => s.trim()) : [],
        consultationTypes: req.body.consultationTypes ? req.body.consultationTypes.split(',').map(s => s.trim()) : ['in-person', 'video-call', 'phone']
      },
      pricing: {
        hourlyRate: parseFloat(req.body.pricing.hourlyRate),
        currency: req.body.pricing.currency || 'KES',
        consultationFee: req.body.consultationFee ? parseFloat(req.body.consultationFee) : 0,
        packageRates: req.body.packageRates ? JSON.parse(req.body.packageRates) : []
      },
      availability: {
        hours: req.body.availabilityHours || '9:00 AM - 6:00 PM',
        days: req.body.availabilityDays ? req.body.availabilityDays.split(',') : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        noticeRequired: req.body.noticeRequired || '24 hours',
        emergencyConsultation: req.body.emergencyConsultation === 'true'
      },
      location: {
        city: req.body.location.city,
        address: req.body.location.address,
        coordinates: req.body.location.coordinates ? JSON.parse(req.body.location.coordinates) : null,
        remoteConsultation: req.body.remoteConsultation === 'true'
      },
      contact: {
        phone: req.body.contact.phone,
        email: req.body.contact.email || req.user.email,
        whatsapp: req.body.contact.whatsapp,
        linkedin: req.body.contact.linkedin,
        website: req.body.contact.website
      },
      verification: {
        verified: false,
        documents: [],
        licenses: [],
        professionalBody: req.body.professionalBody,
        licenseNumber: req.body.licenseNumber
      },
      stats: {
        views: 0,
        consultations: 0,
        clients: 0,
        rating: 0,
        reviewCount: 0,
        responseRate: 0
      },
      status: 'pending'
    };

    const service = new ProfessionalService(serviceData);
    await service.save();

    res.status(201).json(service);
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT api/professional-services/:id
// @desc    Update professional service
// @access  Private (Professional)
router.put('/:id', auth, upload.array('images', 5), async (req, res) => {
  try {
    const service = await ProfessionalService.findById(req.params.id);

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    if (service.professional.toString() !== req.user.id && req.user.role !== 'admin') {
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

// @route   DELETE api/professional-services/:id
// @desc    Delete professional service
// @access  Private (Professional)
router.delete('/:id', auth, async (req, res) => {
  try {
    const service = await ProfessionalService.findById(req.params.id);

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    if (service.professional.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await service.deleteOne();
    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/professional-services/:id/consult
// @desc    Book a consultation
// @access  Private
router.post('/:id/consult', auth, [
  body('date').isISO8601().withMessage('Valid date is required'),
  body('time').trim().notEmpty().withMessage('Time is required'),
  body('consultationType').isIn(['in-person', 'video-call', 'phone']).withMessage('Invalid consultation type'),
  body('topic').trim().notEmpty().withMessage('Consultation topic is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const service = await ProfessionalService.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    if (service.status !== 'active') {
      return res.status(400).json({ message: 'Service is not available' });
    }

    const booking = new ServiceBooking({
      service: service._id,
      serviceType: 'professional-service',
      customer: req.user.id,
      provider: service.professional,
      date: req.body.date,
      time: req.body.time,
      address: req.body.consultationType === 'in-person' ? req.body.address : 'Remote consultation',
      description: req.body.description,
      estimatedCost: service.pricing.hourlyRate + (service.pricing.consultationFee || 0),
      status: 'pending',
      consultationType: req.body.consultationType,
      topic: req.body.topic
    });

    await booking.save();

    // Update service stats
    service.stats.consultations = (service.stats.consultations || 0) + 1;
    await service.save();

    res.status(201).json(booking);
  } catch (error) {
    console.error('Book consultation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/professional-services/professional/:professionalId
// @desc    Get all services by a professional
// @access  Public
router.get('/professional/:professionalId', async (req, res) => {
  try {
    const services = await ProfessionalService.find({ 
      professional: req.params.professionalId,
      status: 'active' 
    }).sort({ createdAt: -1 });

    res.json(services);
  } catch (error) {
    console.error('Get professional services error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/professional-services/:id/review
// @desc    Add review to professional service
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

    const service = await ProfessionalService.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const review = {
      user: req.user.id,
      rating: parseInt(req.body.rating),
      comment: req.body.comment,
      professionalFeedback: req.body.professionalFeedback,
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