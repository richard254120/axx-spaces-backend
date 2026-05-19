import express from "express";
import Material from "../models/Material.js";
import { auth } from "../middleware/auth.js";
import upload from "../config/multer.js";

const router = express.Router();

// ============ CREATE MATERIAL (Sell) — sellers only ============
router.post("/create", auth, upload.array("images", 8), async (req, res) => {
  try {
    if (req.user.role !== "seller" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Only sellers can upload materials" });
    }
    const { title, description, category, subcategory, price, quantity, condition, location, county, lat, lng } = req.body;
    if (!title || !description || !category || !price || !quantity) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Please upload at least one image" });
    }
    const imageUrls = req.files.map((file) => file.path);
    const material = new Material({
      title, description, category, subcategory,
      price: parseFloat(price),
      quantity: parseInt(quantity),
      condition, location, county,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
      images: imageUrls,
      seller: req.user._id,
      sellerName: req.user.name,
      sellerPhone: req.user.phone,
      status: "pending",
      isVerified: false,
    });
    await material.save();
    res.status(201).json({ success: true, message: "Material submitted! It will be visible after admin approval.", material });
  } catch (error) {
    console.error("Create material error:", error);
    res.status(500).json({ error: error.message || "Failed to create material" });
  }
});

// ============ GET ALL APPROVED MATERIALS (public browse) ============
router.get("/", async (req, res) => {
  try {
    const { category, condition, minPrice, maxPrice, county, search } = req.query;
    let filter = { status: "active", isVerified: true };
    if (category) filter.category = category;
    if (condition) filter.condition = condition;
    if (county) filter.county = county;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }
    const materials = await Material.find(filter)
      .populate("seller", "name phone isApproved")
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(materials);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ✅ SPECIFIC ROUTES BEFORE /:id ============

// GET SELLER'S OWN MATERIALS (all statuses)
router.get("/seller/my-materials", auth, async (req, res) => {
  try {
    const materials = await Material.find({ seller: req.user._id }).sort({ createdAt: -1 });
    res.json(materials);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ADMIN — GET ALL PENDING MATERIALS
router.get("/admin/pending", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }
    const materials = await Material.find({ status: "pending" })
      .populate("seller", "name email phone")
      .sort({ createdAt: -1 });
    res.json(materials);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ GET SINGLE MATERIAL ============
router.get("/:id", async (req, res) => {
  try {
    const material = await Material.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    ).populate("seller", "name phone isApproved");
    if (!material) return res.status(404).json({ error: "Material not found" });
    res.json(material);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN — APPROVE MATERIAL ============
router.patch("/:id/approve", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }
    const material = await Material.findByIdAndUpdate(
      req.params.id,
      { status: "active", isVerified: true },
      { new: true }
    );
    if (!material) return res.status(404).json({ error: "Material not found" });
    res.json({ success: true, message: "Material approved and now visible", material });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN — REJECT MATERIAL ============
router.patch("/:id/reject", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }
    const material = await Material.findByIdAndUpdate(
      req.params.id,
      { status: "archived", isVerified: false },
      { new: true }
    );
    if (!material) return res.status(404).json({ error: "Material not found" });
    res.json({ success: true, message: "Material rejected", material });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ UPDATE MATERIAL ============
router.patch("/:id", auth, async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).json({ error: "Material not found" });
    if (material.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    const { title, description, price, quantity, condition, status } = req.body;
    if (title) material.title = title;
    if (description) material.description = description;
    if (price) material.price = parseFloat(price);
    if (quantity) material.quantity = parseInt(quantity);
    if (condition) material.condition = condition;
    if (status) material.status = status;
    await material.save();
    res.json({ success: true, message: "Material updated", material });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ DELETE MATERIAL ============
router.delete("/:id", auth, async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).json({ error: "Material not found" });
    if (material.seller.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }
    await Material.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Material deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ MARK AS SOLD ============
router.patch("/:id/sold", auth, async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).json({ error: "Material not found" });
    if (material.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    material.status = "sold";
    await material.save();
    res.json({ success: true, message: "Material marked as sold", material });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ SEND INQUIRY ============
router.post("/:id/inquiry", auth, async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).json({ error: "Material not found" });
    material.inquiries = (material.inquiries || 0) + 1;
    await material.save();
    res.json({ success: true, message: "Inquiry sent!", sellerPhone: material.sellerPhone });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
