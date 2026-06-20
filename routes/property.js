import express from "express";
import Property from "../models/Property.js";
import User from "../models/User.js";
import { auth } from "../middleware/auth.js";
import upload from "../config/multer.js";
import { sendPropertyEmail, sendPropertyApprovalEmail } from "../utils/email.js";
import security from "../middleware/security.js";
import { trackPropertyView } from "../middleware/viewTracking.js";

const router = express.Router();

// ====================== CREATE PROPERTY ======================
router.post(["/", "/create"], auth, security.uploadLimiter, upload.array("images", 10), async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        error: "User does not exist or invalid token. Please login again."
      });
    }

    const {
      title, description, location, price, bedrooms, bathrooms,
      amenities, totalUnits, deposit, furnished, leaseType,
      availableFrom, rules, propertyType, county, lat, lng,
      bookedUnits, initiallyBooked, university, universityId
    } = req.body;

    if (!title || !description || !location || !price || !propertyType || !county) {
      return res.status(400).json({ error: "❌ Missing required fields" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "❌ Please upload at least one image" });
    }

    const owner = await User.findById(req.user._id).select("landlordType");
    const mustLinkUniversity =
      owner?.landlordType === "university" || propertyType === "Hostel Room";

    if (mustLinkUniversity && (!universityId || !university)) {
      return res.status(400).json({
        error:
          "University is required for hostel listings and near-campus landlords. Select the university your property is linked to.",
      });
    }

    let parsedAmenities = [];
    try {
      parsedAmenities = amenities ? JSON.parse(amenities) : [];
    } catch (e) {
      parsedAmenities = Array.isArray(amenities) ? amenities : [];
    }

    if (parsedAmenities.length === 0) {
      return res.status(400).json({ error: "❌ Please select at least one amenity" });
    }

    const imageUrls = req.files.map((file) => file.path || file.secure_url);

    const property = new Property({
      title,
      description,
      location,
      price: parseFloat(price),
      bedrooms: parseInt(bedrooms),
      bathrooms: parseInt(bathrooms),
      amenities: parsedAmenities,
      images: imageUrls,
      owner: req.user._id,
      totalUnits: parseInt(totalUnits) || 1,
      status: "pending",
      propertyType,
      county,
      university: university || "",
      universityId: universityId || "",
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
      deposit: deposit ? parseFloat(deposit) : undefined,
      furnished: furnished === "true" || furnished === true,
      leaseType: leaseType || "monthly",
      availableFrom: availableFrom || undefined,
      rules: rules || "",
      bookedUnits: initiallyBooked === "true" || initiallyBooked === true
        ? parseInt(bookedUnits) || 0
        : 0,
    });

    await property.save();

    const fullUser = await User.findById(req.user._id).select("name email phone landlordType");
    sendPropertyEmail(property, fullUser || req.user);

    console.log(`✅ Property created successfully | Owner: ${req.user._id}`);

    res.status(201).json({
      success: true,
      message: "✅ Property uploaded successfully! Pending admin approval.",
      property: {
        _id: property._id,
        title: property.title,
        status: property.status,
        createdAt: property.createdAt,
      }
    });

  } catch (error) {
    console.error("❌ Create property error:", error);
    res.status(500).json({ error: error.message || "Failed to create property" });
  }
});

// ====================== GET ALL APPROVED PROPERTIES ======================
// Supports query params used by MapView:
//   ?limit=200
//   ?county=Nairobi
//   ?propertyType=apartment
//   ?minPrice=10000&maxPrice=150000
//   ?bedrooms=2
//   ?furnished=true
//   ?featured=true
//   ?available=true   (availableUnits > 0)
//   ?search=westlands (searches title, location, county)
router.get("/", async (req, res) => {
  try {
    const {
      limit,
      county,
      propertyType,
      minPrice,
      maxPrice,
      bedrooms,
      furnished,
      featured,
      available,
      search,
      university,
      universityId,
    } = req.query;

    const query = { status: "approved" };

    if (county) query.county = county;
    if (universityId) query.universityId = universityId;
    else if (university) query.university = university;
    if (propertyType) query.propertyType = { $regex: new RegExp(`^${propertyType}$`, "i") };
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }
    if (bedrooms) query.bedrooms = parseInt(bedrooms);
    if (furnished === "true") query.furnished = true;
    if (featured === "true") query.isFeatured = true;
    if (available === "true") query.$expr = {
      $gt: [
        { $subtract: ["$totalUnits", "$bookedUnits"] }, 0
      ]
    };
    if (search) {
      const re = new RegExp(search, "i");
      query.$or = [{ title: re }, { location: re }, { county: re }];
    }

    const cap = Math.min(parseInt(limit) || 100, 500);

    const properties = await Property.find(query)
      .populate("owner", "name phone email verificationBadges")
      .sort({ isFeatured: -1, createdAt: -1 })   // featured pins always first
      .limit(cap);

    const processed = properties.map(p => ({
      ...p.toObject(),
      availableUnits: Math.max(0, (p.totalUnits || 1) - (p.bookedUnits || 0)),
    }));

    res.json(processed);
  } catch (error) {
    console.error("❌ Get properties error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch properties" });
  }
});

// ====================== GET SINGLE PROPERTY ======================
// Used by MapView "View listing →" links and detail pages
router.get("/:id", trackPropertyView, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate("owner", "name phone email");

    if (!property) return res.status(404).json({ error: "❌ Property not found" });

    res.json({
      ...property.toObject(),
      availableUnits: Math.max(0, (property.totalUnits || 1) - (property.bookedUnits || 0)),
    });
  } catch (error) {
    console.error("❌ Get single property error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch property" });
  }
});

// ====================== INCREMENT VIEW COUNT ======================
// Call from your property detail page on mount: PATCH /api/properties/:id/view
router.patch("/:id/view", async (req, res) => {
  try {
    await Property.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to record view" });
  }
});

// ====================== REVIEWS ======================

router.get("/:id/reviews", async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: "Property not found" });
    res.json(property.reviews || []);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

router.post("/:id/reviews", async (req, res) => {
  try {
    const { name, rating, comment } = req.body;

    if (!name || !rating || !comment) {
      return res.status(400).json({ error: "Name, rating and comment are required" });
    }

    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: "Property not found" });

    property.reviews.push({
      name: name.trim(),
      rating: Number(rating),
      comment: comment.trim(),
    });

    await property.save();

    res.status(201).json({ success: true, message: "✅ Review submitted successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to submit review" });
  }
});

// ====================== MY PROPERTIES ======================
router.get("/my-properties/all", auth, async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user._id }).sort({ createdAt: -1 });
    res.json(properties);
  } catch (error) {
    console.error("❌ Get my properties error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch properties" });
  }
});

// ====================== ADMIN ======================
router.get("/admin/pending", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "❌ Access denied. Admin only." });
    }
    const properties = await Property.find({ status: "pending" })
      .populate("owner", "name phone email")
      .sort("-createdAt");
    res.json(properties);
  } catch (error) {
    console.error("❌ Get pending properties error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.patch("/:id/status", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "❌ Access denied. Admin only." });
    }
    const { status } = req.body;
    if (!["approved", "rejected", "pending", "sold"].includes(status)) {
      return res.status(400).json({ error: "❌ Invalid status value" });
    }
    const property = await Property.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate("owner", "email");
    if (!property) return res.status(404).json({ error: "❌ Property not found" });
    if (status === "approved") {
      await sendPropertyApprovalEmail(property.owner.email, property.title);
    }
    res.json({ success: true, message: `✅ Property ${status}`, property });
  } catch (error) {
    console.error("❌ Update status error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ====================== UPDATE PROPERTY (ADMIN EDIT) ======================
router.patch("/:id", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "❌ Access denied. Admin only." });
    }
    const property = await Property.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!property) return res.status(404).json({ error: "❌ Property not found" });
    res.json({ success: true, property });
  } catch (error) {
    console.error("❌ Update property error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ====================== BOOKING ======================
router.patch("/:id/book", auth, async (req, res) => {
  try {
    const { change } = req.body;
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: "❌ Property not found" });

    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "❌ Unauthorized" });
    }

    const newBooked = (property.bookedUnits || 0) + change;
    if (newBooked < 0) return res.status(400).json({ error: "❌ Cannot have negative booked units" });
    if (newBooked > (property.totalUnits || 1)) return res.status(400).json({ error: "❌ Cannot book more than total units" });

    property.bookedUnits = newBooked;
    await property.save();
    res.json({ success: true, message: "✅ Booking updated", property });
  } catch (error) {
    console.error("❌ Book property error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ====================== DELETE ======================
router.delete("/:id", auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: "❌ Property not found" });

    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "❌ Unauthorized" });
    }

    if (property.bookedUnits > 0) return res.status(400).json({ error: "❌ Cannot delete property with active bookings." });

    await Property.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "✅ Property deleted successfully" });
  } catch (error) {
    console.error("❌ Delete property error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;