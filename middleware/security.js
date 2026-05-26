// security.js - Modern ES Module Version
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';

// Helmet Configuration
const helmetConfig = helmet({
  contentSecurityPolicy: false,           // Set to true later when you have proper CSP
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
});

// CORS Configuration
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://axxspace.com",
    "https://www.axxspace.com",
    "https://axx-spaces-frontend.vercel.app"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
};

// Rate Limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts. Try again in 15 minutes." },
});

function applyTo(app) {
  // Order is important
  app.use(cookieParser());
  app.use(helmetConfig);
  app.use(cors(corsOptions));
  app.use(generalLimiter);
  app.use(mongoSanitize());
  app.use(xss());
  app.use(hpp());

  console.log("🔒 [security.js] All security middleware applied successfully");
}

export default {
  applyTo,
  generalLimiter,
  authLimiter,
};