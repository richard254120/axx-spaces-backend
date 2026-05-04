import express from "express";
import Property from "../models/Property.js";
import { auth } from "../middleware/auth.js";
import upload from "../config/multer.js";
import { v2 as cloudinary } from "cloudinary";

const router = express.Router();

// ============ CREATE PROPERTY ============
router.post("/create", auth, upload.array("images", 10), async (req, res) => {
  try {
    const { title, description, location, price, bedrooms, bathrooms, amenities, totalUnits } = req.body;

    if (!title || !description || !location || !price || !bedrooms || !bathrooms) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // When using CloudinaryStorage in multer, req.files[i].path is already the Cloudinary URL
    const imageUrls = req.files ? req.files.map(file => file.path) : [];

    const property = new Property({
      title,
      description,
      location,
      price: parseFloat(price),
      bedrooms: parseInt(bedrooms),
      bathrooms: parseInt(bathrooms),
      amenities: amenities ? (typeof amenities === 'string' ? JSON.parse(amenities) : amenities) : [],
      images: imageUrls,
      owner: req.user.id,
      totalUnits: parseInt(totalUnits) || 1,
      bookedUnits: 0,
    });

    await property.save();
    res.status(201).json({ success: true, property });
  } catch (error) {
    console.error("❌ Error creating property:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ GET ALL APPROVED PROPERTIES ============
router.get("/", async (req, res) => {
  try {
    const properties = await Property.find({ status: "approved" })
      .populate("owner", "name phone")
      .sort({ createdAt: -1 });
    res.json(properties);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ GET LANDLORD'S PROPERTIES ============
router.get("/my-properties/all", auth, async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json(properties);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ MARK/UNMARK BOOKED ============
router.put("/:id/mark-booked", auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property || property.owner.toString() !== req.user.id) return res.status(404).json({ error: "Unauthorized or not found" });

    property.bookedUnits = Math.min(property.totalUnits, (property.bookedUnits || 0) + 1);
    await property.save();
    res.json({ success: true, property });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ DELETE PROPERTY ============
router.delete("/:id", auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property || property.owner.toString() !== req.user.id) return res.status(403).json({ error: "Unauthorized" });

    // Clean up images from Cloudinary
    if (property.images && property.images.length > 0) {
      for (const url of property.images) {
        const publicId = url.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`axx-spaces/${publicId}`);
      }
    }

    await Property.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Property deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;