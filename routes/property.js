import express from "express";
import Property from "../models/Property.js";
import { auth } from "../middleware/auth.js";
import upload from "../config/multer.js";

const router = express.Router();

// ============ CREATE PROPERTY ============
router.post("/create", auth, upload.array("images", 10), async (req, res) => {
  try {
    const { title, description, location, price, bedrooms, bathrooms, amenities, totalUnits } = req.body;

    // Validation
    if (!title || !description || !location || !price || bedrooms === undefined || bathrooms === undefined) {
      return res.status(400).json({ error: "❌ Missing required fields" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "❌ Please upload at least one image" });
    }

    const imageUrls = req.files.map((file) => file.path);

    const property = new Property({
      title,
      description,
      location,
      price: parseFloat(price),
      bedrooms: parseInt(bedrooms),
      bathrooms: parseInt(bathrooms),
      amenities: amenities ? JSON.parse(amenities) : [],
      images: imageUrls,
      owner: req.user.id,
      totalUnits: parseInt(totalUnits) || 1,
      bookedUnits: 0,
      status: "pending",
    });

    await property.save();
    res.status(201).json({ success: true, message: "✅ Property uploaded successfully!", property });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to create property" });
  }
});

// ============ GET ALL APPROVED PROPERTIES (Public Listings) ============
router.get("/", async (req, res) => {
  try {
    const properties = await Property.find({ 
      status: "approved",
      availableUnits: { $gt: 0 }
    })
      .populate("owner", "name phone email")
      .sort({ createdAt: -1 });

    res.json(properties);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch properties" });
  }
});

// ============ ADMIN: GET ALL PENDING PROPERTIES ============
router.get("/admin/pending", auth, async (req, res) => {
  try {
    // Security check: Only allow users with admin role
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "❌ Access denied. Admin only." });
    }

    const properties = await Property.find({ status: "pending" })
      .populate("owner", "name phone email")
      .sort("-createdAt");
    res.json(properties);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN: UPDATE STATUS (APPROVE/REJECT) ============
router.patch("/:id/status", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "❌ Access denied. Admin only." });
    }

    const { status } = req.body; // Expects 'approved' or 'rejected'
    const property = await Property.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!property) return res.status(404).json({ error: "❌ Property not found" });

    res.json({ success: true, message: `✅ Property ${status}`, property });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ GET SINGLE PROPERTY ============
router.get("/:id", async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).populate(
      "owner",
      "name phone email"
    );
    if (!property) return res.status(404).json({ error: "❌ Property not found" });
    res.json(property);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch property" });
  }
});

// ============ GET LANDLORD'S ALL PROPERTIES ============
router.get("/my-properties/all", auth, async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json(properties);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch properties" });
  }
});

// ============ MARK PROPERTY AS BOOKED ============
router.put("/:id/mark-booked", auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: "❌ Property not found" });

    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "❌ Unauthorized" });
    }

    if (property.bookedUnits >= property.totalUnits) {
      return res.status(400).json({ error: "❌ All units are already booked" });
    }

    property.bookedUnits += 1;
    await property.save();

    res.json({ success: true, message: "✅ Property marked as booked", property });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ UNMARK PROPERTY AS BOOKED ============
router.put("/:id/unmark-booked", auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: "❌ Property not found" });

    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "❌ Unauthorized" });
    }

    if (property.bookedUnits <= 0) {
      return res.status(400).json({ error: "❌ No booked units to unmark" });
    }

    property.bookedUnits -= 1;
    await property.save();

    res.json({ success: true, message: "✅ Booked status removed", property });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ DELETE PROPERTY ============
router.delete("/:id", auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: "❌ Property not found" });

    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "❌ Unauthorized" });
    }

    if (property.bookedUnits > 0) {
      return res.status(400).json({ error: "❌ Cannot delete property with active bookings." });
    }

    await Property.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "✅ Property deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;