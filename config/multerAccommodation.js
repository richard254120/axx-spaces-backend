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
  params: async (req, file) => {
    const isVideo = file.mimetype && file.mimetype.startsWith("video/");
    return {
      folder: "axx-spaces/accommodations",
      resource_type: isVideo ? "video" : "image",
      ...(isVideo ? {} : { format: "jpg" }),
      public_id: `acc-${isVideo ? "video" : "img"}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    };
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype &&
    (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/"))
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only image and video files are allowed"), false);
  }
};

const accommodationUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit per file (for video walkthroughs)
});

export default accommodationUpload;
