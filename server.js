import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

// Import Routes (Ensure the .js extension is included for ESM)
import propertyRoutes from "./routes/property.js";
import authRoutes from "./routes/auth.js";

// === CONFIGURATION ===
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// === CLOUDINARY SETUP ===
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// === MIDDLEWARE ===
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://axx-spaces-frontend.vercel.app",
  ],
  methods: ["GET", "POST", "PATCH", "DELETE", "PUT"],
  credentials: true
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static folder for temporary uploads (if needed)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
if (!fs.existsSync(path.join(__dirname, "uploads"))) {
  fs.mkdirSync(path.join(__dirname, "uploads"), { recursive: true });
}

// === ROUTES ===
app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);

// Root Health Check
app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "Axx Spaces API is running",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString()
  });
});

// === DATABASE CONNECTION ===
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected Successfully");
  } catch (err) {
    console.error("❌ MongoDB Connection Failed:", err.message);
    // Exit process with failure
    process.exit(1);
  }
};

connectDB();

// === GLOBAL ERROR HANDLER ===
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

// === SERVER START ===
const PORT = process.env.PORT || 1000;
app.listen(PORT, () => {
  console.log(`
  🚀 Server is flying on port ${PORT}
  📍 Local: http://localhost:${PORT}
  🔗 API Base: http://localhost:${PORT}/api
  `);
});

export default app;