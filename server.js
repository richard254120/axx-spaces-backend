import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import authRoutes from "./routes/auth.js";
import propertyRoutes from "./routes/property.js";
import { auth } from "./middleware/auth.js";

dotenv.config();

const app = express();

// ============ MIDDLEWARE ============
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173", "http://localhost:5000", process.env.FRONTEND_URL],
  credentials: true,
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

console.log("✅ Middleware configured");

// ============ MONGODB CONNECTION ============
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

// ============ HEALTH CHECK ============
app.get("/api/health", (req, res) => {
  res.json({
    status: "✅ Server running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// ============ TEST ENDPOINTS (OPTIONAL - for debugging) ============
app.get("/api/test/auth", (req, res) => {
  res.json({ message: "✅ Auth routes working" });
});

app.get("/api/test/properties", (req, res) => {
  res.json({ message: "✅ Property routes working" });
});

// ============ ROUTES ============
app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);

// ============ ERROR HANDLING MIDDLEWARE ============
app.use((err, req, res, next) => {
  console.error("❌ Error:", {
    message: err.message,
    stack: err.stack,
    status: err.status || 500,
  });

  // Multer errors
  if (err.name === "MulterError") {
    if (err.code === "FILE_TOO_LARGE") {
      return res.status(400).json({ error: "❌ File is too large (max 8MB)" });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({ error: "❌ Too many files (max 10)" });
    }
    return res.status(400).json({ error: `❌ Upload error: ${err.message}` });
  }

  // Custom errors
  if (err.message && err.message.includes("Only image files")) {
    return res.status(400).json({ error: "❌ Only image files are allowed" });
  }

  res.status(err.status || 500).json({
    error: err.message || "❌ Internal server error",
  });
});

// ============ 404 HANDLER ============
app.use((req, res) => {
  console.warn("⚠️ 404 - Route not found:", req.method, req.path);
  res.status(404).json({ error: "❌ Endpoint not found" });
});

// ============ START SERVER ============
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log("\n");
  console.log("╔════════════════════════════════════════╗");
  console.log("║       🚀 AXX SPACES SERVER STARTED     ║");
  console.log("╚════════════════════════════════════════╝");
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`☁️  Cloudinary: Configured`);
  console.log(`📦 Database: MongoDB`);
  console.log(`\n📌 API Endpoints:`);
  console.log(`   - GET    /api/health`);
  console.log(`   - POST   /api/auth/register`);
  console.log(`   - POST   /api/auth/login`);
  console.log(`   - POST   /api/auth/forgot-password`);
  console.log(`   - POST   /api/auth/reset-password`);
  console.log(`   - POST   /api/properties/create`);
  console.log(`   - GET    /api/properties`);
  console.log(`   - GET    /api/properties/:id`);
  console.log(`   - GET    /api/properties/my-properties/active`);
  console.log(`   - GET    /api/properties/my-properties/booked`);
  console.log(`   - PUT    /api/properties/:id/mark-booked`);
  console.log(`   - PUT    /api/properties/:id/unmark-booked`);
  console.log(`   - DELETE /api/properties/:id`);
  console.log(`\n`);
});

// ============ GRACEFUL SHUTDOWN ============
process.on("SIGTERM", () => {
  console.log("\n⚠️  SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("✅ Server closed");
    mongoose.connection.close(false, () => {
      console.log("✅ MongoDB connection closed");
      process.exit(0);
    });
  });
});

export default app;