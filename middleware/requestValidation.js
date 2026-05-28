// Request validation middleware for backend security
import { body, param, query, validationResult } from 'express-validator';

// Validation rules for common fields
export const validationRules = {
  // User registration
  register: [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('name').isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
    body('email').trim().notEmpty().withMessage('Email is required'),
    body('email').isEmail().withMessage('Invalid email format'),
    body('phone').trim().notEmpty().withMessage('Phone is required'),
    body('phone').matches(/^(\+254|0)?[7]\d{8}$/).withMessage('Invalid phone number format'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('password').matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number'),
  ],

  // Login
  login: [
    body('email').trim().notEmpty().withMessage('Email is required'),
    body('email').isEmail().withMessage('Invalid email format'),
    body('password').notEmpty().withMessage('Password is required'),
  ],

  // Property
  property: [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('title').isLength({ min: 5, max: 100 }).withMessage('Title must be 5-100 characters'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('description').isLength({ min: 20, max: 2000 }).withMessage('Description must be 20-2000 characters'),
    body('location').trim().notEmpty().withMessage('Location is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('bedrooms').optional().isInt({ min: 0 }).withMessage('Bedrooms must be a non-negative integer'),
    body('bathrooms').optional().isInt({ min: 0 }).withMessage('Bathrooms must be a non-negative integer'),
  ],

  // Material
  material: [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('title').isLength({ min: 5, max: 100 }).withMessage('Title must be 5-100 characters'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('description').isLength({ min: 20, max: 2000 }).withMessage('Description must be 20-2000 characters'),
    body('category').isIn(['Construction Materials', 'Furniture', 'Appliances', 'Electronics', 'Tools', 'Other']).withMessage('Invalid category'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('condition').isIn(['Like New', 'Good', 'Fair', 'Poor']).withMessage('Invalid condition'),
  ],

  // Tourism
  tourism: [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('title').isLength({ min: 5, max: 100 }).withMessage('Title must be 5-100 characters'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('description').isLength({ min: 20, max: 2000 }).withMessage('Description must be 20-2000 characters'),
    body('category').isIn(['Hotel', 'Resort', 'Lodge', 'Campsite', 'Guest House', 'Other']).withMessage('Invalid category'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('location').trim().notEmpty().withMessage('Location is required'),
  ],

  // ID parameter
  id: [
    param('id').isMongoId().withMessage('Invalid ID format'),
  ],

  // Pagination
  pagination: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  ],
};

// Middleware to check validation results
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// Sanitize request body to prevent injection attacks
export const sanitizeBody = (req, res, next) => {
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        // Remove potentially dangerous characters
        req.body[key] = req.body[key]
          .replace(/[<>]/g, '') // Remove angle brackets
          .replace(/javascript:/gi, '') // Remove javascript: protocol
          .replace(/on\w+\s*=/gi, '') // Remove event handlers
          .trim();
      }
    }
  }
  next();
};

// Check for SQL/NoSQL injection patterns
export const detectInjection = (req, res, next) => {
  const injectionPatterns = [
    /\$\{.*\}/, // Template literals
    /'.*OR.*'/i, // SQL injection
    /'.*AND.*'/i, // SQL injection
    /'.*UNION.*SELECT/i, // SQL injection
    /'.*DROP.*TABLE/i, // SQL injection
    /'.*DELETE.*FROM/i, // SQL injection
    /'.*UPDATE.*SET/i, // SQL injection
    /\$ne/i, // NoSQL injection
    /\$gt/i, // NoSQL injection
    /\$lt/i, // NoSQL injection
    /\$in/i, // NoSQL injection
    /\$where/i, // NoSQL injection
  ];

  const checkValue = (value) => {
    if (typeof value === 'string') {
      return injectionPatterns.some(pattern => pattern.test(value));
    } else if (typeof value === 'object' && value !== null) {
      for (const key in value) {
        if (checkValue(value[key])) return true;
      }
    }
    return false;
  };

  if (checkValue(req.body) || checkValue(req.query) || checkValue(req.params)) {
    console.log('🚨 Injection attack detected');
    return res.status(400).json({ error: 'Malicious request detected' });
  }

  next();
};

// Rate limit per user
export const userRateLimit = (maxRequests = 50, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    const userId = req.user?._id?.toString() || req.ip;
    const now = Date.now();
    const userRequests = requests.get(userId) || [];

    // Remove old requests outside the time window
    const validRequests = userRequests.filter(time => now - time < windowMs);

    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.'
      });
    }

    validRequests.push(now);
    requests.set(userId, validRequests);

    next();
  };
};

export default {
  validationRules,
  validate,
  sanitizeBody,
  detectInjection,
  userRateLimit
};
