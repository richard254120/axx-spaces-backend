import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { uploadLogo, uploadBusinessPhotos, uploadProductImage, uploadPricelist } from "../config/multerBusiness.js";
import { v2 as cloudinary } from "cloudinary";
import { auth, adminOnly } from "../middleware/auth.js";
import { normalizePricelistPublicId, toAbsoluteUploadUrl } from "../utils/fileUrls.js";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = express.Router();

function redirectPricelistDownload(req, res) {
  try {
    const directUrl = req.query.url;
    if (directUrl && String(directUrl).startsWith("http")) {
      return res.redirect(String(directUrl));
    }

    const rawId = req.query.publicId || req.params?.[0];
    const publicId = normalizePricelistPublicId(rawId);

    if (!publicId) {
      return res.status(400).json({ error: "Missing or invalid pricelist publicId" });
    }

    const downloadUrl = cloudinary.url(publicId, {
      resource_type: "auto",
      secure: true,
      sign_url: true,
      flags: "attachment",
    });

    return res.redirect(downloadUrl);
  } catch (error) {
    console.error("Pricelist download error:", error);
    return res.status(500).json({ error: "Failed to generate download link" });
  }
}

// ====================== UPLOAD BUSINESS LOGO ======================
router.post("/logo", uploadLogo.single("logo"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    res.json({
      success: true,
      url: req.file.path,
      publicId: req.file.filename,
      message: "Logo uploaded successfully",
    });
  } catch (error) {
    console.error("Logo upload error:", error);
    res.status(500).json({ error: "Failed to upload logo" });
  }
});

// ====================== UPLOAD BUSINESS PHOTOS (MULTIPLE - UP TO 18) ======================
router.post("/business-photos", uploadBusinessPhotos.array("photos", 18), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const uploadedUrls = req.files.map((file) => file.path);
    const uploadedIds = req.files.map((file) => file.filename);

    res.json({
      success: true,
      urls: uploadedUrls,
      publicIds: uploadedIds,
      count: req.files.length,
      message: `${req.files.length} photo(s) uploaded successfully`,
    });
  } catch (error) {
    console.error("Business photos upload error:", error);
    res.status(500).json({ error: "Failed to upload business photos" });
  }
});

// ====================== UPLOAD SINGLE BUSINESS PHOTO ======================
router.post("/business-photo", uploadBusinessPhotos.single("photo"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    res.json({
      success: true,
      url: req.file.path,
      publicId: req.file.filename,
      message: "Photo uploaded successfully",
    });
  } catch (error) {
    console.error("Business photo upload error:", error);
    res.status(500).json({ error: "Failed to upload business photo" });
  }
});

// ====================== UPLOAD PRODUCT IMAGE ======================
router.post("/product-image", uploadProductImage.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    res.json({
      success: true,
      url: req.file.path,
      publicId: req.file.filename,
      message: "Product image uploaded successfully",
    });
  } catch (error) {
    console.error("Product image upload error:", error);
    res.status(500).json({ error: "Failed to upload product image" });
  }
});

// ====================== UPLOAD PRICELIST DOCUMENT ======================
router.post("/pricelist", uploadPricelist.single("pricelist"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    res.json({
      success: true,
      url: req.file.path,
      publicId: req.file.filename,
      originalName: req.file.originalname,
      message: "Pricelist uploaded successfully",
    });
  } catch (error) {
    console.error("Pricelist upload error:", error);
    res.status(500).json({ error: "Failed to upload pricelist" });
  }
});

// ====================== DOWNLOAD PRICELIST DOCUMENT ======================
router.get("/pricelist/download", redirectPricelistDownload);
router.get(/^\/pricelist\/(.+)$/, (req, res) => {
  req.query = { ...req.query, publicId: req.params[0] };
  return redirectPricelistDownload(req, res);
});

// ====================== KYC / VERIFICATION DOCUMENTS (ADMIN) ======================
router.get("/verification/:filename", auth, adminOnly, (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(__dirname, "../uploads/verification", filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Verification file not found" });
    }

    return res.sendFile(filePath);
  } catch (error) {
    console.error("Verification file download error:", error);
    return res.status(500).json({ error: "Failed to serve verification file" });
  }
});

export default router;
