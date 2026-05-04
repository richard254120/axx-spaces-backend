import express from "express";
import Property from "../models/Property.js";
import { auth } from "../middleware/auth.js";
import upload from "../config/multer.js";

const router = express.Router();

// CREATE PROPERTY
router.post("/create", auth, upload.array("images", 10), async (req, res) => {
  try {
    const { title, location, county, price, bedrooms, bathrooms, description, totalUnits } = req.body;

    if (!title || !location || !price) {
      return res.status(400).json({ success: false, error: "Title, location and price are required" });
    }

    const imageUrls = req.files ? req.files.map(file => file.path) : [];

    const property = new Property({
      title,
      location,
      county,
      price: parseFloat(price),
      bedrooms: parseInt(bedrooms) || 0,
      bathrooms: parseInt(bathrooms) || 0,
      description,
      images: imageUrls,
      owner: req.user.id,
      totalUnits: parseInt(totalUnits) || 1,
      status: "pending"
    });

    await property.save();

    res.status(201).json({
      success: true,
      message: "Property uploaded successfully! Waiting for approval.",
      property
    });
  } catch (error) {
    console.error("Create Property Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET LANDLORD'S ACTIVE PROPERTIES
router.get("/my-properties/active", auth, async (req, res) => {
  try {
    const properties = await Property.find({ 
      owner: req.user.id,
      status: { $in: ["pending", "approved"] }
    }).sort({ createdAt: -1 });

    res.json(properties);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET BOOKED PROPERTIES
router.get("/my-properties/booked", auth, async (req, res) => {
  try {
    const properties = await Property.find({ 
      owner: req.user.id,
      bookedUnits: { $gt: 0 }
    }).sort({ createdAt: -1 });

    res.json(properties);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// MARK AS BOOKED
router.put("/:id/mark-booked", auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property || property.owner.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    property.bookedUnits = Math.min(property.totalUnits, (property.bookedUnits || 0) + 1);
    await property.save();

    res.json({ success: true, property });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE PROPERTY
router.delete("/:id", auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property || property.owner.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    await Property.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Property deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;