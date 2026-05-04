import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

// Import Routes
import propertyRoutes from "./routes/property.js";
import authRoutes from "./routes/auth.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ====================== CLOUDINARY CONFIG ======================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ====================== MIDDLEWARE ======================
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://axx-spaces-frontend.vercel.app",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static uploads folder
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// ====================== ROUTES ======================
app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);

// Health Check
app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "Axx Spaces API is running ✅",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString()
  });
});

// ====================== DATABASE CONNECTION ======================
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in .env file");
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected Successfully");
  } catch (err) {
    console.error("❌ MongoDB Connection Failed:", err.message);
    process.exit(1);
  }
};

connectDB();

// ====================== GLOBAL ERROR HANDLER ======================
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal Server Error",
  });
});

// ====================== START SERVER ======================
const PORT = process.env.PORT || 1000;
app.listen(PORT, () => {
  console.log(`
  🚀 Server is running on port ${PORT}
  📍 Local: http://localhost:${PORT}
  🔗 Auth: http://localhost:${PORT}/api/auth
  🏠 Properties: http://localhost:${PORT}/api/properties
  `);
});

export default app;