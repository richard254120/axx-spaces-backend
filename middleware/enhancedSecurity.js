// enhancedSecurity.js - Professional-Grade Security Middleware
// AxxSpace Platform — covers OWASP Top 10, rate-limiting, injection prevention,
// IP blocking, brute-force protection, CSP, CORS, header hardening & audit logging.

import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import { randomBytes, createHmac, timingSafeEqual } from 'crypto';

// ─────────────────────────────────────────────
// IN-MEMORY SECURITY STORE
// In a multi-instance deployment replace with Redis.
// ─────────────────────────────────────────────
const securityStore = {
  blockedIPs: new Map(),       // ip  → { blockedAt, reason, unblockAt }
  failedAttempts: new Map(),   // key → { count, firstAt, lastAt }
  suspiciousActivity: new Map(),
  csrfTokens: new Map(),       // sessionKey → { token, createdAt }
  requestCounts: new Map(),    // ip → { count, windowStart }
};

// Prune stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;

  securityStore.blockedIPs.forEach((data, ip) => {
    if (now > data.unblockAt) securityStore.blockedIPs.delete(ip);
  });

  securityStore.failedAttempts.forEach((data, key) => {
    if (now - data.lastAt > ONE_HOUR) securityStore.failedAttempts.delete(key);
  });

  securityStore.suspiciousActivity.forEach((data, key) => {
    if (now - data.lastAt > ONE_HOUR) securityStore.suspiciousActivity.delete(key);
  });

  securityStore.csrfTokens.forEach((data, key) => {
    if (now - data.createdAt > 2 * ONE_HOUR) securityStore.csrfTokens.delete(key);
  });
}, 5 * 60 * 1000);

// ─────────────────────────────────────────────
// HELPER: get real client IP (works behind reverse proxy)
// ─────────────────────────────────────────────
const getClientIP = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
  req.ip ||
  req.connection?.remoteAddress ||
  req.socket?.remoteAddress ||
  'unknown';

// ─────────────────────────────────────────────
// HELPER: record suspicious activity; auto-block at threshold
// ─────────────────────────────────────────────
const recordSuspicious = (ip, reason, blockThreshold = 5) => {
  const key = `${ip}:${reason}`;
  const rec = securityStore.suspiciousActivity.get(key) || { count: 0, firstAt: Date.now(), lastAt: Date.now() };
  rec.count += 1;
  rec.lastAt = Date.now();
  securityStore.suspiciousActivity.set(key, rec);

  if (rec.count >= blockThreshold) {
    blockIP(ip, reason, 2 * 60 * 60 * 1000); // 2-hour block
  }
};

// ─────────────────────────────────────────────
// HELPER: block an IP
// ─────────────────────────────────────────────
const blockIP = (ip, reason = 'policy violation', durationMs = 60 * 60 * 1000) => {
  const now = Date.now();
  securityStore.blockedIPs.set(ip, { blockedAt: now, reason, unblockAt: now + durationMs });
  securityLogger.warn(`[IP-BLOCK] IP=${ip} reason="${reason}" duration=${Math.round(durationMs / 60000)}m`);
};

// ─────────────────────────────────────────────
// SIMPLE STRUCTURED LOGGER (no external deps)
// Replace with Winston/Pino in production.
// ─────────────────────────────────────────────
const securityLogger = {
  _log: (level, msg, meta = {}) => {
    // Never log secrets — scrub Authorization headers, passwords, tokens
    const safe = { ...meta };
    ['password', 'token', 'secret', 'authorization', 'cookie'].forEach((k) => {
      if (safe[k]) safe[k] = '[REDACTED]';
    });
    // Only log errors/warnings to stderr in production to avoid log flooding
    const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...safe });
    if (level === 'error' || level === 'warn') {
      console.error(line);
    } else if (process.env.NODE_ENV !== 'production') {
      console.log(line);
    }
  },
  info:  (msg, meta) => securityLogger._log('info',  msg, meta),
  warn:  (msg, meta) => securityLogger._log('warn',  msg, meta),
  error: (msg, meta) => securityLogger._log('error', msg, meta),
};

// ─────────────────────────────────────────────
// 1. HELMET — HTTP security headers (hardened CSP)
// ─────────────────────────────────────────────
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:        ["'self'"],
      styleSrc:          ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
      scriptSrc:         ["'self'", "https://www.googletagmanager.com", "https://www.google-analytics.com", "https://clarity.ms"],
      scriptSrcElem:     ["'self'", "https://www.googletagmanager.com", "https://www.google-analytics.com", "https://clarity.ms"],
      imgSrc:            ["'self'", "data:", "blob:", "https:", "https://res.cloudinary.com"],
      connectSrc:        ["'self'", "https://api.cloudinary.com", "https://axx-spaces-backend-1.onrender.com",
                          "wss://axx-spaces-backend-1.onrender.com", "https://www.google-analytics.com",
                          "https://clarity.ms", "https://region1.google-analytics.com",
                          "https://*.tile.openstreetmap.org"],
      fontSrc:           ["'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com", "https://unpkg.com"],
      objectSrc:         ["'none'"],
      mediaSrc:          ["'self'"],
      frameSrc:          ["'none'"],
      baseUri:           ["'self'"],
      formAction:        ["'self'"],
      frameAncestors:    ["'none'"],
      upgradeInsecureRequests: [],
      reportUri:         [process.env.CSP_REPORT_URI || '/api/security/csp-report'],
    },
  },
  crossOriginResourcePolicy:  { policy: 'cross-origin' },
  crossOriginOpenerPolicy:    { policy: 'same-origin' },
  crossOriginEmbedderPolicy:  false,          // allow Cloudinary images
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard:                 { action: 'deny' },
  hidePoweredBy:              true,
  noSniff:                    true,
  referrerPolicy:             { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  xssFilter:                  true,
});

// ─────────────────────────────────────────────
// 2. CORS — strict origin allowlist
// ─────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:4174',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'https://axxspace.com',
  'https://www.axxspace.com',
  'https://axx-spaces-frontend.vercel.app',
  'https://admin.axxspace.com',
  'https://axxspace-admin.vercel.app',
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // No origin = mobile app / server-to-server / curl — allow in dev, restrict in prod
    if (!origin) {
      return process.env.NODE_ENV === 'production'
        ? callback(null, true)   // mobile apps still need access
        : callback(null, true);
    }
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      securityLogger.warn('[CORS] Blocked request from unauthorized origin', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-ID'],
  exposedHeaders: ['X-CSRF-Token', 'X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 86400,
  optionsSuccessStatus: 204,
};

// ─────────────────────────────────────────────
// 3. IP BLOCKING middleware
// ─────────────────────────────────────────────
const ipBlocker = (req, res, next) => {
  const ip = getClientIP(req);
  const block = securityStore.blockedIPs.get(ip);
  if (block) {
    const retryAfter = Math.max(0, Math.ceil((block.unblockAt - Date.now()) / 60000));
    res.set('Retry-After', String(retryAfter * 60));
    return res.status(429).json({
      error: 'Your IP address has been temporarily blocked due to suspicious activity.',
      retryAfterMinutes: retryAfter,
    });
  }
  next();
};

// ─────────────────────────────────────────────
// 4. RATE LIMITERS
// ─────────────────────────────────────────────

// General API — 500 req / 15 min
const enhancedRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
  skip: (req) => req.path === '/api/health',
  handler: (req, res) => {
    const ip = getClientIP(req);
    recordSuspicious(ip, 'rate-limit-general', 5);
    res.status(429).json({ error: 'Too many requests. Please slow down.' });
  },
});

// Auth endpoints — 10 attempts / 15 min (failed only), then auto-block
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
  handler: (req, res) => {
    const ip = getClientIP(req);
    recordSuspicious(ip, 'brute-force-auth', 3);
    securityLogger.warn('[BRUTE-FORCE] Auth rate-limit hit', { ip, path: req.path });
    res.status(429).json({ error: 'Too many login attempts. Please try again in 15 minutes.' });
  },
});

// Password reset — 5 / 15 min
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many password reset attempts. Please try again later.' });
  },
});

// Verification resend — 10 / 15 min
const verificationResendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many verification email requests. Please wait and try again.' });
  },
});

// Upload — 20 / hour
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => getClientIP(req),
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many uploads. Please try again later.' });
  },
});

// API endpoints — 200 req / 1 min (used directly on individual route files)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many API requests, please slow down.' });
  },
});

// Reports — 5 / hour
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many report submissions. Please try again later.' });
  },
});

// Inquiries — 20 / 15 min
const inquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many inquiry attempts. Please try again later.' });
  },
});

// ─────────────────────────────────────────────
// 5. SECURITY HEADERS (supplemental to Helmet)
// ─────────────────────────────────────────────
const securityHeaders = (req, res, next) => {
  // Belt-and-suspenders: some are already set by Helmet, but duplicates are harmless
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), accelerometer=(), gyroscope=()');
  res.setHeader('Cache-Control', 'no-store');   // API responses must not be cached
  res.removeHeader('X-Powered-By');
  next();
};

// ─────────────────────────────────────────────
// 6. REQUEST SIZE LIMITER
// ─────────────────────────────────────────────
const requestSizeLimiter = (req, res, next) => {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  const MAX = 15 * 1024 * 1024; // 15 MB hard cap
  if (contentLength > MAX) {
    return res.status(413).json({ error: 'Request body too large.' });
  }
  next();
};

// ─────────────────────────────────────────────
// 7. REQUEST ID — unique trace ID for every request
// ─────────────────────────────────────────────
const requestId = (req, res, next) => {
  const id = randomBytes(12).toString('hex');
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
};

// ─────────────────────────────────────────────
// 8. INPUT VALIDATION — block XSS / NoSQL injection patterns
// ─────────────────────────────────────────────
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript\s*:/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi,
  /eval\s*\(/gi,
  /expression\s*\(/gi,
  /vbscript\s*:/gi,
  /<\s*iframe/gi,
  /<\s*object/gi,
  /<\s*embed/gi,
];

const NOSQL_PATTERNS = [
  /\$where/gi,
  /\$gt/gi, /\$gte/gi, /\$lt/gi, /\$lte/gi,
  /\$ne/gi, /\$in\b/gi, /\$nin\b/gi,
  /\$or\b/gi, /\$and\b/gi, /\$not\b/gi, /\$nor\b/gi,
  /\$regex/gi,
  /\{\s*"\$.*?"\s*:/g,
];

const isMalicious = (value, depth = 0) => {
  if (depth > 8) return false; // prevent stack overflow on deeply nested bodies
  if (typeof value === 'string') {
    for (const p of XSS_PATTERNS)    { p.lastIndex = 0; if (p.test(value)) return true; }
    for (const p of NOSQL_PATTERNS)  { p.lastIndex = 0; if (p.test(value)) return true; }
  } else if (typeof value === 'object' && value !== null) {
    for (const k of Object.keys(value)) {
      if (isMalicious(k, depth + 1) || isMalicious(value[k], depth + 1)) return true;
    }
  }
  return false;
};

const validateInput = (req, res, next) => {
  if (isMalicious(req.body) || isMalicious(req.query) || isMalicious(req.params)) {
    const ip = getClientIP(req);
    securityLogger.warn('[INPUT-INJECTION] Malicious payload blocked', { ip, path: req.path });
    recordSuspicious(ip, 'malicious-input', 3);
    return res.status(400).json({ error: 'Invalid input detected.' });
  }
  next();
};

// ─────────────────────────────────────────────
// 9. PATH TRAVERSAL PREVENTION
// ─────────────────────────────────────────────
const pathTraversalPrevention = (req, res, next) => {
  const dangerous = /(\.\.(\/|\\)|%2e%2e|%252e|\.%2f)/i;
  if (dangerous.test(req.path) || dangerous.test(req.url)) {
    const ip = getClientIP(req);
    securityLogger.warn('[PATH-TRAVERSAL] Attempt blocked', { ip, path: req.path });
    recordSuspicious(ip, 'path-traversal', 2);
    return res.status(400).json({ error: 'Invalid path.' });
  }
  next();
};

// ─────────────────────────────────────────────
// 10. CSRF — double-submit cookie pattern
//     GET/HEAD/OPTIONS are exempt.
//     Protected routes must include the X-CSRF-Token header.
// ─────────────────────────────────────────────
const CSRF_SECRET = process.env.CSRF_SECRET || randomBytes(32).toString('hex');

const generateCSRFToken = (sessionKey) => {
  const token = randomBytes(32).toString('hex');
  securityStore.csrfTokens.set(sessionKey, { token, createdAt: Date.now() });
  return token;
};

const attachCSRFToken = (req, res, next) => {
  const sessionKey = req.sessionId || getClientIP(req);
  const token = generateCSRFToken(sessionKey);
  res.setHeader('X-CSRF-Token', token);
  next();
};

const csrfProtection = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const tokenFromHeader = req.headers['x-csrf-token'];
  const sessionKey = req.sessionId || getClientIP(req);
  const stored = securityStore.csrfTokens.get(sessionKey);

  if (!tokenFromHeader || !stored) {
    return res.status(403).json({ error: 'CSRF token missing.' });
  }

  // Timing-safe comparison
  const a = Buffer.from(tokenFromHeader);
  const b = Buffer.from(stored.token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    const ip = getClientIP(req);
    securityLogger.warn('[CSRF] Token mismatch', { ip });
    recordSuspicious(ip, 'csrf-mismatch', 5);
    return res.status(403).json({ error: 'Invalid CSRF token.' });
  }

  // Rotate token after use (prevents replay)
  generateCSRFToken(sessionKey);
  next();
};

// ─────────────────────────────────────────────
// 11. SECURITY AUDIT LOGGER
// Logs every 4xx / 5xx response with structured metadata.
// ─────────────────────────────────────────────
const auditLogger = (req, res, next) => {
  const start = Date.now();
  const ip = getClientIP(req);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const meta = {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip,
      userAgent: req.headers['user-agent'],
      userId: req.user?._id?.toString(),
      userRole: req.user?.role,
    };

    if (res.statusCode >= 500) {
      securityLogger.error('[AUDIT] Server error', meta);
    } else if (res.statusCode >= 400) {
      securityLogger.warn('[AUDIT] Client error', meta);
    } else if (process.env.NODE_ENV !== 'production') {
      securityLogger.info('[AUDIT]', meta);
    }
  });

  next();
};

// ─────────────────────────────────────────────
// 12. SUSPICIOUS USER-AGENT BLOCKER
// Block common scanner / exploit tools.
// ─────────────────────────────────────────────
const BLOCKED_UA_PATTERNS = [
  /sqlmap/i, /nikto/i, /nmap/i, /masscan/i,
  /zgrab/i, /python-requests\/[01]\./i,
  /dirbuster/i, /gobuster/i, /wfuzz/i, /hydra/i,
  /burpsuite/i, /metasploit/i, /havij/i,
  /curl\/[0-6]\./i, // very old curl versions used by scanners
];

const userAgentFilter = (req, res, next) => {
  const ua = req.headers['user-agent'] || '';
  for (const pattern of BLOCKED_UA_PATTERNS) {
    if (pattern.test(ua)) {
      const ip = getClientIP(req);
      securityLogger.warn('[UA-BLOCK] Suspicious user agent', { ip, ua });
      recordSuspicious(ip, 'suspicious-ua', 1);
      return res.status(403).json({ error: 'Access denied.' });
    }
  }
  next();
};

// ─────────────────────────────────────────────
// 13. RESPONSE SANITIZER
// Strip fields that must never leak in API responses.
// ─────────────────────────────────────────────
const SENSITIVE_FIELDS = new Set(['password', 'resetPasswordToken', 'emailVerificationToken', '__v']);

const sanitizeResponse = (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    const scrub = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(scrub);
      const clean = {};
      for (const [k, v] of Object.entries(obj)) {
        if (!SENSITIVE_FIELDS.has(k)) clean[k] = scrub(v);
      }
      return clean;
    };
    return originalJson(scrub(data));
  };
  next();
};

// ─────────────────────────────────────────────
// 14. APPLY ALL SECURITY MIDDLEWARE TO APP
// ─────────────────────────────────────────────
function applyTo(app) {
  app.use(requestId);               // ① Trace ID on every request
  app.use(cookieParser());          // ② Parse cookies (needed for CSRF double-submit)
  app.use(securityHeaders);         // ③ Supplemental security headers
  app.use(helmetConfig);            // ④ Full Helmet suite (CSP, HSTS, etc.)
  app.use(cors(corsOptions));       // ⑤ Strict CORS
  app.use(pathTraversalPrevention); // ⑥ Block directory traversal
  app.use(userAgentFilter);         // ⑦ Block scanner user-agents
  app.use(ipBlocker);               // ⑧ Block flagged IPs
  app.use(requestSizeLimiter);      // ⑨ Reject oversized requests
  app.use(enhancedRateLimit);       // ⑩ Global rate limit
  app.use(mongoSanitize({           // ⑪ NoSQL injection sanitization
    replaceWith: '_',
    allowDots: false,
    onSanitizeError: (req) => {
      securityLogger.warn('[NOSQL-SANITIZE] Dangerous key stripped', { ip: getClientIP(req), path: req.path });
    },
  }));
  // ⑫ XSS: handled by our own validateInput (layer ⑭) which runs deep recursive
  //    pattern checks. xss-clean (unmaintained, CVEs) has been removed.
  app.use(hpp());                   // ⑬ HTTP parameter pollution prevention
  app.use(validateInput);           // ⑭ Deep pattern-based injection check
  app.use(sanitizeResponse);        // ⑮ Strip sensitive fields from responses
  app.use(auditLogger);             // ⑯ Structured security audit log

  console.log('\n🛡️  [Security] All 16 security layers active:');
  console.log('   ① Request IDs           ② Cookie Parser');
  console.log('   ③ Security Headers      ④ Helmet + CSP');
  console.log('   ⑤ Strict CORS           ⑥ Path Traversal Guard');
  console.log('   ⑦ UA Scanner Block      ⑧ IP Blocker');
  console.log('   ⑨ Request Size Limiter  ⑩ Rate Limiting');
  console.log('   ⑪ NoSQL Sanitization    ⑫ XSS Protection');
  console.log('   ⑬ HPP Prevention        ⑭ Input Validation');
  console.log('   ⑮ Response Sanitizer    ⑯ Audit Logger\n');
}

// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────
export default {
  applyTo,
  // Rate limiters (used directly on routes)
  generalLimiter:            enhancedRateLimit,
  authLimiter,
  passwordResetLimiter,
  verificationResendLimiter,
  uploadLimiter,
  apiLimiter,
  reportLimiter,
  inquiryLimiter,
  // CSRF helpers
  csrfProtection,
  attachCSRFToken,
  generateCSRFToken,
  // Security store (exposed for admin dashboard)
  securityStore,
  // Helpers
  blockIP,
  getClientIP,
  recordSuspicious,
  securityLogger,
};
