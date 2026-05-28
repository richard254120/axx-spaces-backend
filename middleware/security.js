// security.js - Modern ES Module Version
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';

// Helmet Configuration - Enhanced security headers
const helmetConfig = helmet({
  contentSecurityPolicy: false,           // CSP is handled in frontend index.html
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,                     // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },         // Prevent clickjacking
  hidePoweredBy: true,                   // Hide Express header
  noSniff: true,                         // Prevent MIME type sniffing
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,                       // Add XSS protection header
  permittedCrossDomainPolicies: [],      // No cross-domain policies allowed
});

// CORS Configuration - Restrict origins
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://axxspace.com",
      "https://www.axxspace.com",
      "https://axx-spaces-frontend.vercel.app",
      "https://admin.axxspace.com",
      "https://axxspace-admin.vercel.app"
    ];
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Content-Range", "X-Total-Count"],
  maxAge: 86400,                          // 24 hours
  optionsSuccessStatus: 204
};

// Rate Limiters - Enhanced with different limits for different endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,              // 15 minutes
  max: 100,                              // 100 requests per window
  message: { error: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for trusted IPs if needed
    return false;
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,              // 15 minutes
  max: 5,                               // Stricter limit for auth endpoints
  message: { error: "Too many login attempts. Try again in 15 minutes." },
  skipSuccessfulRequests: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,              // 1 minute
  max: 30,                              // 30 requests per minute
  message: { error: "Too many API requests, please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,             // 1 hour
  max: 10,                              // 10 uploads per hour
  message: { error: "Too many upload attempts. Please try again later." },
});

function applyTo(app) {
  // Order is important
  app.use(cookieParser({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Secure cookies in production
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }));
  app.use(helmetConfig);
  app.use(cors(corsOptions));
  app.use(generalLimiter);
  app.use(mongoSanitize());               // NoSQL injection protection
  app.use(xss());                         // XSS protection
  app.use(hpp());                        // HTTP parameter pollution protection

  // Additional security middleware
  app.use((req, res, next) => {
    // Remove sensitive headers
    res.removeHeader('X-Powered-By');
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  console.log("🔒 [security.js] All security middleware applied successfully");
}

export default {
  applyTo,
  generalLimiter,
  authLimiter,
  apiLimiter,
  uploadLimiter,
};