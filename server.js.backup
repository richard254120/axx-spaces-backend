import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import authRoutes from "./routes/auth.js";
import propertyRoutes from "./routes/property.js";

dotenv.config();

const app = express();

// ============ CORS - ALLOW ALL ORIGINS FOR TESTING ============
app.use(cors({
  origin: "*", // Allow all origins temporarily
  credentials: false,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.options("*", cors());

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

console.log("✅ Middleware configured");

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "🚀 Axx Spaces API running",
    time: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  res.status(500).json({ error: err.message || "Server error" });
});

const PORT = process.env.PORT || 1000;

app.listen(PORT, () => {
  console.log("==================================");
  console.log("🚀 AXX SPACES SERVER STARTED");
  console.log("==================================");
  console.log("📍 Port:", PORT);
  console.log("🌍 Environment:", process.env.NODE_ENV || "development");
  console.log("☁️ Cloudinary: Configured");
  console.log("📦 Database: MongoDB");
  console.log(`🔗 API: http://localhost:${PORT}/api`);
  console.log("==================================\n");
});

export default app;