import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Security Middleware
import security from "./middleware/security.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Routes
import authRoutes from "./routes/auth.js";
import propertyRoutes from "./routes/property.js";
import paymentRoutes from "./routes/payment.js";
import moverRoutes from "./routes/moverRoutes.js";
import materialRoutes from "./routes/materials.js";
import verificationRoutes from "./routes/verification.js";
import kycVerificationRoutes from "./routes/kycVerification.js";
import sellerAuthRoutes from "./routes/sellerAuth.js";
import jobRoutes from "./routes/jobs.js";
import tourismRoutes from "./routes/tourism.js";
import profileRoutes from "./routes/profile.js";
import reviewRoutes from "./routes/reviews.js";
import adminRoutes from "./routes/admin.js";
import paymentVerificationRoutes from "./routes/paymentVerification.js";
import businessRoutes from "./routes/business.js";
import businessReviewRoutes from "./routes/businessReviews.js";
import favoritesRoutes from "./routes/favorites.js";
import businessInquiryRoutes from "./routes/businessInquiries.js";
import businessAnalyticsRoutes from "./routes/businessAnalytics.js";
import businessSubscriptionRoutes from "./routes/businessSubscriptions.js";
import uploadRoutes from "./routes/uploads.js";
import analyticsRoutes from "./routes/analytics.js";
import badgeRoutes from "./routes/badges.js";
import notificationRoutes from "./routes/notifications.js";
import itemRequestRoutes from "./routes/itemRequests.js";
import configRoutes from "./routes/config.js";

dotenv.config();

// Create necessary directories
const uploadsDir = path.join(__dirname, 'uploads');
const verificationDir = path.join(uploadsDir, 'verification');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created uploads directory');
}

if (!fs.existsSync(verificationDir)) {
  fs.mkdirSync(verificationDir, { recursive: true });
  console.log('✅ Created uploads/verification directory');
}

const app = express();

// ====================== TRUST PROXY ======================
// Required for Render (and any reverse proxy) so that express-rate-limit
// correctly identifies users by their real IP via X-Forwarded-For,
// and so req.protocol returns "https" in production.
app.set("trust proxy", 1);

// ====================== SECURITY MIDDLEWARE ======================
security.applyTo(app);

// ====================== BODY PARSERS ======================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

console.log("✅ Security middleware configured");

// ====================== MONGODB CONNECTION ======================
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB connected");

    // Run database index migrations
    try {
      const db = mongoose.connection.db;
      const collections = await db.listCollections({ name: "users" }).toArray();
      if (collections.length > 0) {
        const usersCollection = db.collection("users");

        // List existing indexes
        const indexes = await usersCollection.indexes();
        console.log("🔍 Checking existing indexes on 'users' collection...");

        // Look for single field unique indexes on email and phone
        for (const index of indexes) {
          if (index.name === "email_1" && index.unique) {
            console.log("🗑️ Dropping index email_1...");
            await usersCollection.dropIndex("email_1");
          }
          if (index.name === "phone_1" && index.unique) {
            console.log("🗑️ Dropping index phone_1...");
            await usersCollection.dropIndex("phone_1");
          }
        }

        // Create new compound indexes if they don't exist
        console.log("🏗️ Creating compound unique indexes...");
        await usersCollection.createIndex({ email: 1, role: 1 }, { unique: true });
        await usersCollection.createIndex({ phone: 1, role: 1 }, { unique: true });
        console.log("✅ Compound unique indexes configured successfully");
      }
    } catch (indexErr) {
      console.error("⚠️ Error updating unique indexes:", indexErr.message);
    }
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

// ====================== ROUTES ======================
app.use("/api/auth", authRoutes);
app.use("/api/properties", security.apiLimiter, propertyRoutes);
app.use("/api/payment", security.apiLimiter, paymentRoutes);
app.use("/api/movers", security.apiLimiter, moverRoutes);
app.use("/api/materials", security.apiLimiter, materialRoutes);
app.use("/api/verification", security.apiLimiter, verificationRoutes);
app.use("/api/kyc-verification", security.apiLimiter, kycVerificationRoutes);
app.use("/api/seller-auth", security.authLimiter, sellerAuthRoutes);
app.use("/api/jobs", security.apiLimiter, jobRoutes);
app.use("/api/tourism", security.apiLimiter, tourismRoutes);
app.use("/api/profile", security.apiLimiter, profileRoutes);
app.use("/api/reviews", security.apiLimiter, reviewRoutes);
app.use("/api/admin", security.apiLimiter, adminRoutes);
app.use("/api/payment-verification", security.apiLimiter, paymentVerificationRoutes);
app.use("/api/business", security.apiLimiter, businessRoutes);
app.use("/api/business-reviews", security.apiLimiter, businessReviewRoutes);
app.use("/api/favorites", security.apiLimiter, favoritesRoutes);
app.use("/api/business-inquiries", security.apiLimiter, businessInquiryRoutes);
app.use("/api/business-analytics", security.apiLimiter, businessAnalyticsRoutes);
app.use("/api/business-subscriptions", security.apiLimiter, businessSubscriptionRoutes);
app.use("/api/uploads", security.apiLimiter, uploadRoutes);
app.use("/api/badges", security.apiLimiter, badgeRoutes);
app.use("/api/analytics", security.apiLimiter, analyticsRoutes);
app.use("/api/notifications", security.apiLimiter, notificationRoutes);
app.use("/api/item-requests", security.apiLimiter, itemRequestRoutes);
app.use("/api/config", security.apiLimiter, configRoutes);

// ====================== STATIC FILE SERVING ======================
// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/health", (req, res) =>
  res.json({ status: "OK", timestamp: new Date().toISOString() })
);

// ====================== 404 HANDLER ======================
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ====================== HTTPS ENFORCEMENT ======================
// Must be registered before app.listen, but after routes.
// On Render, the proxy handles TLS — req.protocol is set correctly
// only after trust proxy is enabled (done above).
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.protocol === "http") {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// ====================== START SERVER ======================
const PORT = process.env.PORT || 1001;

app.listen(PORT, () => {
  console.log("==================================");
  console.log("🚀 AXX SPACES SERVER STARTED");
  console.log("==================================");
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("🔒 Security: Active (Helmet + Rate Limiting + Sanitization + CSP + Auth)");
});