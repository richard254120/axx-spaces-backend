import express from "express";
import { uploadLogo, uploadBusinessPhotos, uploadProductImage, uploadPricelist } from "../config/multerBusiness.js";

const router = express.Router();

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

    const uploadedUrls = req.files.map(file => file.path);
    const uploadedIds = req.files.map(file => file.filename);

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

export default router;
