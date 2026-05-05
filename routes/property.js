import express from "express";
import Property from "../models/Property.js";
import { auth } from "../middleware/auth.js";
import upload from "../config/multer.js";

const router = express.Router();

// ============ CREATE PROPERTY ============
router.post("/create", auth, upload.array("images", 10), async (req, res) => {
  try {
    const { title, description, location, price, bedrooms, bathrooms, amenities, totalUnits } = req.body;

    console.log("📝 Creating property:", {
      title,
      location,
      price,
      bedrooms,
      bathrooms,
      amenitiesCount: amenities ? JSON.parse(amenities).length : 0,
      imagesCount: req.files?.length || 0,
    });

    // Validation
    if (!title || !description || !location || !price || bedrooms === undefined || bathrooms === undefined) {
      return res.status(400).json({ error: "❌ Missing required fields" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "❌ Please upload at least one image" });
    }

    // Extract Cloudinary URLs from req.files
    // With CloudinaryStorage, files come with path property (Cloudinary URL)
    const imageUrls = req.files.map((file) => file.path);

    console.log("📷 Images uploaded to Cloudinary:", imageUrls);

    // Create property
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
    console.log("✅ Property created:", property._id);

    res.status(201).json({
      success: true,
      message: "✅ Property uploaded successfully!",
      property,
    });
  } catch (error) {
    console.error("❌ Create property error:", error);
    res.status(500).json({ error: error.message || "Failed to create property" });
  }
});

// ============ GET ALL APPROVED PROPERTIES (for Listings) ============
router.get("/", async (req, res) => {
  try {
    console.log("📋 Fetching all approved properties");

    const properties = await Property.find({ 
      status: "approved",
      availableUnits: { $gt: 0 }
    })
      .populate("owner", "name phone email")
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${properties.length} approved properties`);

    res.json(properties);
  } catch (error) {
    console.error("❌ Get properties error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch properties" });
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
      return res.status(404).json({ error: "❌ Property not found" });
    }

    res.json(property);
  } catch (error) {
    console.error("❌ Get property error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch property" });
  }
});

// ============ GET LANDLORD'S ALL PROPERTIES ============
router.get("/my-properties/all", auth, async (req, res) => {
  try {
    console.log("📋 Fetching user properties for:", req.user.id);

    const properties = await Property.find({ owner: req.user.id }).sort({
      createdAt: -1,
    });

    console.log(`✅ Found ${properties.length} properties for user`);

    res.json(properties);
  } catch (error) {
    console.error("❌ Get user properties error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch properties" });
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
    console.error("❌ Get active properties error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch properties" });
  }
});

// ============ GET LANDLORD'S BOOKED PROPERTIES ============
router.get("/my-properties/booked", auth, async (req, res) => {
  try {
    const properties = await Property.find({
      owner: req.user.id,
      bookedUnits: { $gt: 0 },
    }).sort({ createdAt: -1 });

    res.json(properties);
  } catch (error) {
    console.error("❌ Get booked properties error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch properties" });
  }
});

// ============ MARK PROPERTY AS BOOKED ============
router.put("/:id/mark-booked", auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ error: "❌ Property not found" });
    }

    // Check ownership
    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "❌ Unauthorized: Not the property owner" });
    }

    // Check if all units already booked
    if (property.bookedUnits >= property.totalUnits) {
      return res.status(400).json({
        error: "❌ All units are already booked",
        bookedUnits: property.bookedUnits,
        totalUnits: property.totalUnits,
      });
    }

    // Increment booked units
    property.bookedUnits += 1;
    property.availableUnits = property.totalUnits - property.bookedUnits;
    await property.save();

    console.log(`✅ Property ${property._id} marked as booked`);

    res.json({
      success: true,
      message: "✅ Property marked as booked",
      property,
    });
  } catch (error) {
    console.error("❌ Mark booked error:", error);
    res.status(500).json({ error: error.message || "Failed to mark as booked" });
  }
});

// ============ UNMARK PROPERTY AS BOOKED ============
router.put("/:id/unmark-booked", auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ error: "❌ Property not found" });
    }

    // Check ownership
    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "❌ Unauthorized: Not the property owner" });
    }

    // Check if there are booked units
    if (property.bookedUnits <= 0) {
      return res.status(400).json({
        error: "❌ No booked units to unmark",
        bookedUnits: property.bookedUnits,
      });
    }

    // Decrement booked units
    property.bookedUnits -= 1;
    property.availableUnits = property.totalUnits - property.bookedUnits;
    await property.save();

    console.log(`✅ Property ${property._id} unmarked as booked`);

    res.json({
      success: true,
      message: "✅ Booked status removed",
      property,
    });
  } catch (error) {
    console.error("❌ Unmark booked error:", error);
    res.status(500).json({ error: error.message || "Failed to unmark as booked" });
  }
});

// ============ DELETE PROPERTY ============
router.delete("/:id", auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ error: "❌ Property not found" });
    }

    // Check ownership
    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "❌ Unauthorized: Not the property owner" });
    }

    // Prevent deletion if property has booked units
    if (property.bookedUnits > 0) {
      return res.status(400).json({
        error: "❌ Cannot delete property with booked units. Unmark booked units first.",
        bookedUnits: property.bookedUnits,
      });
    }

    // NOTE: Cloudinary images are handled by Cloudinary Storage
    // No manual deletion needed as they're managed by Cloudinary

    await Property.findByIdAndDelete(req.params.id);
    console.log(`✅ Property ${req.params.id} deleted`);

    res.json({
      success: true,
      message: "✅ Property deleted successfully",
    });
  } catch (error) {
    console.error("❌ Delete property error:", error);
    res.status(500).json({ error: error.message || "Failed to delete property" });
  }
});

// ============ UPDATE PROPERTY ============
router.put("/:id", auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ error: "❌ Property not found" });
    }

    // Check ownership
    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "❌ Unauthorized: Not the property owner" });
    }

    // Update fields
    const { title, description, location, price, bedrooms, bathrooms, amenities } = req.body;

    if (title) property.title = title;
    if (description) property.description = description;
    if (location) property.location = location;
    if (price) property.price = parseFloat(price);
    if (bedrooms !== undefined) property.bedrooms = parseInt(bedrooms);
    if (bathrooms !== undefined) property.bathrooms = parseInt(bathrooms);
    if (amenities) property.amenities = JSON.parse(amenities);

    await property.save();
    console.log(`✅ Property ${property._id} updated`);

    res.json({
      success: true,
      message: "✅ Property updated successfully",
      property,
    });
  } catch (error) {
    console.error("❌ Update property error:", error);
    res.status(500).json({ error: error.message || "Failed to update property" });
  }
});

export default router;