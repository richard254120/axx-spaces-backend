import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

// Security Middleware
import security from "./middleware/security.js";

// Routes
import authRoutes from "./routes/auth.js";
import propertyRoutes from "./routes/property.js";
import paymentRoutes from "./routes/payment.js";
import moverRoutes from "./routes/moverRoutes.js";
import materialRoutes from "./routes/materials.js";
import verificationRoutes from "./routes/verification.js";
import sellerAuthRoutes from "./routes/sellerAuth.js";
import jobRoutes from "./routes/jobs.js";
import tourismRoutes from "./routes/tourism.js";
import profileRoutes from "./routes/profile.js";
import reviewRoutes from "./routes/reviews.js";
import adminRoutes from "./routes/admin.js";

dotenv.config();

const app = express();

// ====================== SECURITY MIDDLEWARE ======================
security.applyTo(app);

// ====================== BODY PARSERS ======================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

console.log("✅ Security middleware configured");

// ====================== MONGODB CONNECTION ======================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

// ====================== ROUTES ======================
app.use("/api/auth", security.authLimiter, authRoutes);
app.use("/api/properties", security.apiLimiter, propertyRoutes);
app.use("/api/payment", security.apiLimiter, paymentRoutes);
app.use("/api/movers", security.apiLimiter, moverRoutes);
app.use("/api/materials", security.apiLimiter, materialRoutes);
app.use("/api/verification", security.apiLimiter, verificationRoutes);
app.use("/api/seller-auth", security.authLimiter, sellerAuthRoutes);
app.use("/api/jobs", security.apiLimiter, jobRoutes);
app.use("/api/tourism", security.apiLimiter, tourismRoutes);
app.use("/api/profile", security.apiLimiter, profileRoutes);
app.use("/api/reviews", security.apiLimiter, reviewRoutes);
app.use("/api/admin", security.apiLimiter, adminRoutes);

app.get("/api/health", (req, res) =>
  res.json({ status: "OK", timestamp: new Date().toISOString() })
);

// ====================== 404 HANDLER ======================
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ====================== START SERVER ======================
const PORT = process.env.PORT || 1000;

// HTTPS enforcement in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.protocol === 'http') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

app.listen(PORT, () => {
  console.log("==================================");
  console.log("🚀 AXX SPACES SERVER STARTED");
  console.log("==================================");
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log("🔒 Security: Active (Helmet + Rate Limiting + Sanitization + CSP + Auth)");
});