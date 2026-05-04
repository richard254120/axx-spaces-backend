import express from "express";
import Property from "../models/Property.js"; // Ensure .js extension is present
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

    // Upload images to Cloudinary
    const imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "axx-spaces/properties",
        });
        imageUrls.push(result.secure_url);
      }
    }

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
    });

    await property.save();
    res.json({ success: true, property });
  } catch (error) {
    console.error("Error creating property:", error);
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
    console.error("Error fetching properties:", error);
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

    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }

    res.json(property);
  } catch (error) {
    console.error("Error fetching property:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ GET LANDLORD'S PROPERTIES ============
router.get("/my-properties/all", auth, async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user.id }).sort({
      createdAt: -1,
    });

    res.json(properties);
  } catch (error) {
    console.error("Error fetching user properties:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ GET LANDLORD'S ACTIVE (NON-BOOKED) PROPERTIES ============
router.get("/my-properties/active", auth, async (req, res) => {
  try {
    const properties = await Property.find({
      owner: req.user.id,
      bookedUnits: 0,
    }).sort({ createdAt: -1 });

    res.json(properties);
  } catch (error) {
    console.error("Error fetching active properties:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ GET LANDLORD'S BOOKED PROPERTIES ============
router.get("/my-properties/booked", auth, async (req, res) => {
  try {
    const properties = await Property.find({
      owner: req.user.id,
      $expr: { $gt: ["$bookedUnits", 0] },
    }).sort({ createdAt: -1 });

    res.json(properties);
  } catch (error) {
    console.error("Error fetching booked properties:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ MARK PROPERTY AS BOOKED ============
router.put("/:id/mark-booked", auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }

    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized: Not the property owner" });
    }

    if (property.bookedUnits >= property.totalUnits) {
      return res.status(400).json({
        error: "All units are already booked",
        bookedUnits: property.bookedUnits,
        totalUnits: property.totalUnits,
      });
    }

    property.bookedUnits += 1;
    await property.save();

    res.json({
      success: true,
      message: "Property marked as booked",
      property,
    });
  } catch (error) {
    console.error("Error marking property as booked:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ UNMARK PROPERTY AS BOOKED ============
router.put("/:id/unmark-booked", auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }

    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized: Not the property owner" });
    }

    if (property.bookedUnits <= 0) {
      return res.status(400).json({
        error: "No booked units to unmark",
        bookedUnits: property.bookedUnits,
      });
    }

    property.bookedUnits -= 1;
    await property.save();

    res.json({
      success: true,
      message: "Booked status removed",
      property,
    });
  } catch (error) {
    console.error("Error unmarking booked property:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ DELETE PROPERTY ============
router.delete("/:id", auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }

    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized: Not the property owner" });
    }

    if (property.bookedUnits > 0) {
      return res.status(400).json({
        error: "Cannot delete property with booked units. Unmark booked units first.",
        bookedUnits: property.bookedUnits,
      });
    }

    // Delete images from Cloudinary
    for (const imageUrl of property.images) {
      const parts = imageUrl.split("/");
      const fileName = parts.pop().split(".")[0]; 
      await cloudinary.uploader.destroy(`axx-spaces/properties/${fileName}`);
    }

    await Property.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Property deleted successfully" });
  } catch (error) {
    console.error("Error deleting property:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ UPDATE PROPERTY ============
router.put("/:id", auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }

    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized: Not the property owner" });
    }

    const { title, description, location, price, bedrooms, bathrooms, amenities } = req.body;

    if (title) property.title = title;
    if (description) property.description = description;
    if (location) property.location = location;
    if (price) property.price = parseFloat(price);
    if (bedrooms) property.bedrooms = parseInt(bedrooms);
    if (bathrooms) property.bathrooms = parseInt(bathrooms);
    if (amenities) property.amenities = typeof amenities === 'string' ? JSON.parse(amenities) : amenities;

    await property.save();
    res.json({ success: true, property });
  } catch (error) {
    console.error("Error updating property:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router; // CRITICAL: This was missing!