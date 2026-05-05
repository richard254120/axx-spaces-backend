import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import dotenv from "dotenv";

dotenv.config();

// ============ CLOUDINARY CONFIG ============
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log("☁️ Cloudinary configured");

// ============ CLOUDINARY STORAGE FOR MULTER ============
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "axx-spaces", // Creates folder in Cloudinary
    resource_type: "auto", // Auto-detect file type
    format: async (req, file) => "jpg", // Convert all to JPG
    public_id: (req, file) => {
      // Generate unique filename
      return `property-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    },
  },
});

console.log("✅ CloudinaryStorage configured");

// ============ FILE FILTER ============
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    console.log("✅ Image file accepted:", file.originalname);
    cb(null, true);
  } else {
    console.error("❌ Non-image file rejected:", file.originalname);
    cb(new Error("❌ Only image files are allowed"), false);
  }
};

// ============ MULTER INSTANCE ============
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB limit
  },
});

console.log("✅ Multer configured with CloudinaryStorage");

export default upload;