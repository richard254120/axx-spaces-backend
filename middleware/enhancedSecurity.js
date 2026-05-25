// enhancedSecurity.js - Comprehensive Security Middleware
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import { createHash, randomBytes } from 'crypto';

// In-memory store for blocked IPs and suspicious activity
const securityStore = {
  blockedIPs: new Map(),
  failedAttempts: new Map(),
  suspiciousActivity: new Map(),
};

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  securityStore.blockedIPs.forEach((timestamp, ip) => {
    if (now - timestamp > oneHour) securityStore.blockedIPs.delete(ip);
  });
  
  securityStore.failedAttempts.forEach((data, key) => {
    if (now - data.timestamp > oneHour) securityStore.failedAttempts.delete(key);
  });
  
  securityStore.suspiciousActivity.forEach((data, key) => {
    if (now - data.timestamp > oneHour) securityStore.suspiciousActivity.delete(key);
  });
}, 5 * 60 * 1000); // Run every 5 minutes

// Enhanced Helmet Configuration with CSP
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:", "https://res.cloudinary.com"],
      connectSrc: ["'self'", "https://api.cloudinary.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      reportUri: process.env.CSP_REPORT_URI || '/api/security/csp-report',
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: false,
  ieNoOpen: true,
  xssFilter: true,
});

// Enhanced CORS Configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      process.env.FRONTEND_URL || "https://axx-spaces.vercel.app",
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
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  exposedHeaders: ["X-CSRF-Token"],
  maxAge: 86400,
  optionsSuccessStatus: 204,
};

// IP Blocking Middleware
const ipBlocker = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  
  if (securityStore.blockedIPs.has(ip)) {
    const blockTime = securityStore.blockedIPs.get(ip);
    const timeRemaining = Math.ceil((blockTime + 60 * 60 * 1000 - Date.now()) / 1000 / 60);
    
    return res.status(429).json({
      error: "IP temporarily blocked due to suspicious activity",
      retryAfter: `${timeRemaining} minutes`,
    });
  }
  
  next();
};

// Enhanced Rate Limiter with IP tracking
const enhancedRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health';
  },
  handler: (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    
    // Track suspicious activity
    const key = `${ip}-${req.path}`;
    const current = securityStore.suspiciousActivity.get(key) || { count: 0, timestamp: Date.now() };
    
    if (Date.now() - current.timestamp < 15 * 60 * 1000) {
      current.count++;
      securityStore.suspiciousActivity.set(key, current);
      
      // Block IP if too many violations
      if (current.count >= 5) {
        securityStore.blockedIPs.set(ip, Date.now());
        console.log(`🚫 IP Blocked: ${ip} - Excessive rate limit violations`);
      }
    }
    
    res.status(429).json({ error: "Too many requests from this IP, please try again later." });
  },
});

// Strict Auth Rate Limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many login attempts. Try again in 15 minutes." },
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    const key = `auth-${ip}`;
    
    const current = securityStore.failedAttempts.get(key) || { count: 0, timestamp: Date.now() };
    
    if (Date.now() - current.timestamp < 15 * 60 * 1000) {
      current.count++;
      securityStore.failedAttempts.set(key, current);
      
      // Block IP after 10 failed attempts
      if (current.count >= 10) {
        securityStore.blockedIPs.set(ip, Date.now());
        console.log(`🚫 IP Blocked: ${ip} - Excessive failed auth attempts`);
      }
    }
    
    res.status(429).json({ error: "Too many login attempts. Try again in 15 minutes." });
  },
});

// Input Validation Middleware
const validateInput = (req, res, next) => {
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /eval\(/gi,
    /document\./gi,
    /window\./gi,
    /\.\./gi,
    /union.*select/gi,
    /drop.*table/gi,
    /delete.*from/gi,
    /insert.*into/gi,
  ];
  
  const checkValue = (value) => {
    if (typeof value === 'string') {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(value)) {
          return true;
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const key in value) {
        if (checkValue(value[key])) {
          return true;
        }
      }
    }
    return false;
  };
  
  // Check body, query, and params
  if (checkValue(req.body) || checkValue(req.query) || checkValue(req.params)) {
    const ip = req.ip || req.connection.remoteAddress;
    console.log(`🚨 Suspicious input detected from IP: ${ip}`);
    
    // Track suspicious activity
    const key = `${ip}-suspicious-input`;
    const current = securityStore.suspiciousActivity.get(key) || { count: 0, timestamp: Date.now() };
    
    if (Date.now() - current.timestamp < 60 * 60 * 1000) {
      current.count++;
      securityStore.suspiciousActivity.set(key, current);
      
      if (current.count >= 3) {
        securityStore.blockedIPs.set(ip, Date.now());
        console.log(`🚫 IP Blocked: ${ip} - Suspicious input patterns`);
      }
    }
    
    return res.status(400).json({ error: "Invalid input detected" });
  }
  
  next();
};

// CSRF Token Generation and Validation
const csrfTokens = new Map();

const generateCSRFToken = () => {
  return randomBytes(32).toString('hex');
};

const csrfProtection = (req, res, next) => {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  
  if (!token) {
    return res.status(403).json({ error: 'CSRF token missing' });
  }
  
  const storedToken = csrfTokens.get(req.sessionID || req.ip);
  
  if (!storedToken || storedToken !== token) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
};

const attachCSRFToken = (req, res, next) => {
  const token = generateCSRFToken();
  csrfTokens.set(req.sessionID || req.ip, token);
  res.setHeader('X-CSRF-Token', token);
  next();
};

// Request Size Limiter
const requestSizeLimiter = (req, res, next) => {
  const contentLength = req.headers['content-length'];
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (contentLength && parseInt(contentLength) > maxSize) {
    return res.status(413).json({ error: 'Request entity too large' });
  }
  
  next();
};

// Security Headers Middleware
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
};

// SQL Injection Prevention (additional layer)
const sqlInjectionPrevention = (req, res, next) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|ALTER|CREATE|TRUNCATE)\b)/gi,
    /(;|\-\-|\/\*|\*\/)/g,
    /(\bor\b\s*\d+\s*=\s*\d+)/gi,
    /(\band\b\s*\d+\s*=\s*\d+)/gi,
  ];
  
  const checkForSQL = (value) => {
    if (typeof value === 'string') {
      for (const pattern of sqlPatterns) {
        if (pattern.test(value)) {
          return true;
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const key in value) {
        if (checkForSQL(value[key])) {
          return true;
        }
      }
    }
    return false;
  };
  
  if (checkForSQL(req.body) || checkForSQL(req.query) || checkForSQL(req.params)) {
    const ip = req.ip || req.connection.remoteAddress;
    console.log(`🚨 SQL injection attempt detected from IP: ${ip}`);
    
    // Block immediately for SQL injection attempts
    securityStore.blockedIPs.set(ip, Date.now());
    
    return res.status(400).json({ error: 'Invalid request detected' });
  }
  
  next();
};

// Security Logging Middleware
const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  const ip = req.ip || req.connection.remoteAddress;
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      path: req.path,
      ip: ip,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
    };
    
    // Log suspicious activities
    if (res.statusCode >= 400) {
      console.log('🚨 Security Log:', JSON.stringify(logData));
    }
  });
  
  next();
};

// Apply all security middleware
function applyTo(app) {
  // Order is critical for security
  app.use(cookieParser());
  app.use(securityHeaders);
  app.use(helmetConfig);
  app.use(cors(corsOptions));
  app.use(requestSizeLimiter);
  app.use(ipBlocker);
  app.use(enhancedRateLimit);
  app.use(validateInput);
  app.use(sqlInjectionPrevention);
  app.use(mongoSanitize());
  app.use(xss());
  app.use(hpp());
  app.use(securityLogger);
  
  console.log("🔒 [enhancedSecurity.js] All enhanced security middleware applied successfully");
  console.log("🛡️  Security Features Active:");
  console.log("   - Helmet with CSP");
  console.log("   - Enhanced CORS");
  console.log("   - IP Blocking");
  console.log("   - Rate Limiting");
  console.log("   - Input Validation");
  console.log("   - SQL Injection Prevention");
  console.log("   - XSS Protection");
  console.log("   - MongoDB Sanitization");
  console.log("   - Security Logging");
}

export default {
  applyTo,
  generalLimiter: enhancedRateLimit,
  authLimiter,
  csrfProtection,
  attachCSRFToken,
  generateCSRFToken,
  securityStore,
};
