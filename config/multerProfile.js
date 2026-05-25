import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "axx-spaces/profiles",
    resource_type: "image",
    format: "jpg",
    transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
    public_id: () => `profile-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  },
});

const profileUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Profile photo must be an image (JPG, PNG, WebP)"), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

export default profileUpload;
