import multer from "multer";
import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure local fallback directory exists
const localAxxGoUploadsDir = path.join(__dirname, "../uploads/axxgo");
if (!fs.existsSync(localAxxGoUploadsDir)) {
  fs.mkdirSync(localAxxGoUploadsDir, { recursive: true });
}

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer memory storage (holds files in memory buffer for Sharp processing)
const memoryStorage = multer.memoryStorage();

const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

const axxGoFileFilter = (req, file, cb) => {
  if (allowedMimes.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG, and WebP images are permitted (max 5MB each)."), false);
  }
};

// Multer instance for AxxGo (1 to 8 images, max 5MB each)
export const axxGoUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 8,
  },
  fileFilter: axxGoFileFilter,
});

/**
 * Upload a processed image buffer to Cloudinary with fallback to local disk
 */
async function uploadBuffer(buffer, filename) {
  const isCloudinaryConfigured =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET;

  if (isCloudinaryConfigured) {
    try {
      return await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "axxgo-listings",
            format: "webp",
            resource_type: "image",
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result.secure_url || result.url);
          }
        );
        stream.end(buffer);
      });
    } catch (cErr) {
      console.warn("Cloudinary upload failed, falling back to local disk storage:", cErr.message);
    }
  }

  // Fallback: save to local disk
  const localFilename = `axxgo-${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;
  const localFilePath = path.join(localAxxGoUploadsDir, localFilename);
  fs.writeFileSync(localFilePath, buffer);
  return `/uploads/axxgo/${localFilename}`;
}

/**
 * Process an array of uploaded Multer memory files:
 * 1. Resizes to max 1600px width/height preserving aspect ratio
 * 2. Compresses to WebP (quality 82)
 * 3. Strips all EXIF / GPS / location metadata (Sharp strips metadata by default)
 * 4. Uploads safely and returns array of image URLs
 */
export async function processAndStoreAxxGoImages(files) {
  if (!files || files.length === 0) {
    return [];
  }

  const processedUrls = [];

  for (const file of files) {
    // Sharp processing: resize, strip EXIF metadata (default in Sharp), convert to WebP
    const optimizedBuffer = await sharp(file.buffer)
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();

    const imageUrl = await uploadBuffer(optimizedBuffer, file.originalname);
    processedUrls.push(imageUrl);
  }

  return processedUrls;
}

