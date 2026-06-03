import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import dotenv from "dotenv";
import { validateFileType, validateFileSize, sanitizeFilename } from "../middleware/fileUploadSecurity.js";

dotenv.config();

// ============ CLOUDINARY CONFIG ============
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log("☁️ Cloudinary configured for business uploads");

// ============ CLOUDINARY STORAGE FOR BUSINESS LOGO ============
const logoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "axx-spaces/business/logos",
    resource_type: "image",
    format: async (req, file) => "jpg",
    public_id: (req, file) => {
      return `logo-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    },
  },
});

// ============ CLOUDINARY STORAGE FOR BUSINESS PHOTOS (MULTIPLE) ============
const businessPhotosStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "axx-spaces/business/photos",
    resource_type: "image",
    format: async (req, file) => "jpg",
    public_id: (req, file) => {
      return `photo-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    },
  },
});

// ============ CLOUDINARY STORAGE FOR PRODUCT IMAGES ============
const productStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "axx-spaces/business/products",
    resource_type: "image",
    format: async (req, file) => "jpg",
    public_id: (req, file) => {
      return `product-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    },
  },
});

// ============ CLOUDINARY STORAGE FOR PRICELIST DOCUMENTS ============
const pricelistStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "axx-spaces/business/pricelists",
    resource_type: "auto",
    type: "upload",
    access_mode: "public",
    public_id: (req, file) => {
      const ext = file.originalname.split('.').pop();
      return `pricelist-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    },
  },
});

// ============ FILE FILTER FOR IMAGES ============
const imageFileFilter = (req, file, cb) => {
  try {
    const typeValidation = validateFileType(file, 'images');
    if (!typeValidation.isValid) {
      console.error("❌ Image file rejected:", file.originalname, typeValidation.error);
      return cb(new Error(typeValidation.error), false);
    }

    const sizeValidation = validateFileSize(file, 'images');
    if (!sizeValidation.isValid) {
      console.error("❌ Image file rejected:", file.originalname, sizeValidation.error);
      return cb(new Error(sizeValidation.error), false);
    }

    file.originalname = sanitizeFilename(file.originalname);
    console.log("✅ Image file accepted:", file.originalname);
    cb(null, true);
  } catch (error) {
    console.error("❌ File filter error:", error);
    cb(new Error("File validation failed"), false);
  }
};

// ============ FILE FILTER FOR DOCUMENTS ============
const documentFileFilter = (req, file, cb) => {
  try {
    const typeValidation = validateFileType(file, 'documents');
    if (!typeValidation.isValid) {
      console.error("❌ Document file rejected:", file.originalname, typeValidation.error);
      return cb(new Error(typeValidation.error), false);
    }

    const sizeValidation = validateFileSize(file, 'documents');
    if (!sizeValidation.isValid) {
      console.error("❌ Document file rejected:", file.originalname, sizeValidation.error);
      return cb(new Error(sizeValidation.error), false);
    }

    file.originalname = sanitizeFilename(file.originalname);
    console.log("✅ Document file accepted:", file.originalname);
    cb(null, true);
  } catch (error) {
    console.error("❌ File filter error:", error);
    cb(new Error("File validation failed"), false);
  }
};

// ============ MULTER INSTANCES ============
const uploadLogo = multer({
  storage: logoStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit for logos
  },
});

const uploadBusinessPhotos = multer({
  storage: businessPhotosStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per photo
    files: 18, // Maximum 18 photos
  },
});

const uploadProductImage = multer({
  storage: productStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for product images
  },
});

const uploadPricelist = multer({
  storage: pricelistStorage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for pricelist documents
  },
});

// ============ COMBINED UPLOAD FOR BUSINESS CREATION ============
const uploadBusinessFiles = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

console.log("✅ Multer configured for business uploads");

export { uploadLogo, uploadBusinessPhotos, uploadProductImage, uploadPricelist, uploadBusinessFiles };
