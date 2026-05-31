import express from "express";
import { uploadLogo, uploadProductImage, uploadPricelist } from "../config/multerBusiness.js";

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
