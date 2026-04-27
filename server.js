import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

import propertyRoutes from "./routes/property.js";
import authRoutes from "./routes/auth.js";

// === LOAD .env FILE ===
dotenv.config({ path: "./.env" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ═══════════════════════════════════════════════════════════════
   CLOUDINARY CONFIGURATION
═══════════════════════════════════════════════════════════════ */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log("\n=== CLOUDINARY CONFIG ===");
console.log("✅ Cloud Name:", process.env.CLOUDINARY_CLOUD_NAME ? "Loaded" : "❌ MISSING");
console.log("✅ API Key:", process.env.CLOUDINARY_API_KEY ? "Loaded" : "❌ MISSING");
console.log("✅ API Secret:", process.env.CLOUDINARY_API_SECRET ? "Loaded" : "❌ MISSING");

/* ═══════════════════════════════════════════════════════════════
   EXPRESS APP SETUP
═══════════════════════════════════════════════════════════════ */
const app = express();

/* ═══════════════════════════════════════════════════════════════
   CORS CONFIGURATION
═══════════════════════════════════════════════════════════════ */
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://axx-spaces-frontend.vercel.app",
    "https://*.vercel.app" // Allow all Vercel deployments
  ],
  methods: ["GET", "POST", "PATCH", "DELETE", "PUT"],
  credentials: true
}));

/* ═══════════════════════════════════════════════════════════════
   BODY PARSER
═══════════════════════════════════════════════════════════════ */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ═══════════════════════════════════════════════════════════════
   STATIC FILES (for backward compatibility, though we use Cloudinary)
═══════════════════════════════════════════════════════════════ */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Create uploads folder if it doesn't exist
if (!fs.existsSync(path.join(__dirname, "uploads"))) {
  fs.mkdirSync(path.join(__dirname, "uploads"), { recursive: true });
  console.log("✅ Created /uploads directory");
}

/* ═══════════════════════════════════════════════════════════════
   ROUTES
═══════════════════════════════════════════════════════════════ */
app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);

/* ═══════════════════════════════════════════════════════════════
   HEALTH CHECK
═══════════════════════════════════════════════════════════════ */
app.get("/", (req, res) => {
  res.json({
    message: "✅ Axx Spaces Backend is running",
    cloudinary: "✅ Configured",
    database: "Checking...",
    timestamp: new Date().toISOString()
  });
});

/* ═══════════════════════════════════════════════════════════════
   DATABASE CONNECTION
═══════════════════════════════════════════════════════════════ */
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log("✅ MongoDB Connected");
  })
  .catch(err => {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  });

/* ═══════════════════════════════════════════════════════════════
   ERROR HANDLING MIDDLEWARE
═══════════════════════════════════════════════════════════════ */
app.use((err, req, res, next) => {
  console.error("❌ Error:", err);
  
  // Multer errors
  if (err.message && err.message.includes("Only image files are allowed")) {
    return res.status(400).json({ error: "Only image files are allowed" });
  }
  
  if (err.message && err.message.includes("File too large")) {
    return res.status(400).json({ error: "File size exceeds 5MB limit" });
  }

  res.status(500).json({ 
    error: err.message || "Internal Server Error",
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

/* ═══════════════════════════════════════════════════════════════
   START SERVER
═══════════════════════════════════════════════════════════════ */
const PORT = process.env.PORT || 1000;

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🌐 CORS enabled for Vercel deployments\n`);
});

export default app;