import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import authRoutes from "./routes/auth.js";
import propertyRoutes from "./routes/property.js";

dotenv.config();

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5000",
  process.env.FRONTEND_URL,
  "https://axx-spaces-frontend.onrender.com"
].filter(Boolean);

// ============ CORS FIX ============
app.use(
  cors({
    origin: function (origin, callback) {
      // allow REST tools like Postman
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("❌ Blocked by CORS:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// ============ MIDDLEWARE ============
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

console.log("✅ Middleware configured");

// ============ MONGODB ============
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

// ============ HEALTH CHECK ============
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "🚀 Axx Spaces API running",
    time: new Date().toISOString(),
  });
});

// ============ ROUTES ============
app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);

// ============ 404 ============
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ============ ERROR HANDLER ============
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  res.status(500).json({ error: err.message || "Server error" });
});

// ============ START SERVER ============
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("==================================");
  console.log("🚀 AXX SPACES SERVER STARTED");
  console.log("==================================");
  console.log("📍 Port:", PORT);
  console.log("🌍 Environment:", process.env.NODE_ENV || "development");
  console.log("☁️ Cloudinary: Configured");
  console.log("📦 Database: MongoDB");
});