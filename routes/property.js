import express from "express";
import mongoose from "mongoose";
import Property from "../models/Property.js";
import QRScan from "../models/QRScan.js";
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
    // Only exclude fully-booked properties when the caller explicitly requests
    // available=true (e.g. MapView, university hostel search).
    // The public listings page now shows ALL approved properties;
    // landlord contact info is hidden on the frontend for fully-booked listings.
    const availabilityExpr = {
      $gt: [{ $subtract: ["$totalUnits", "$bookedUnits"] }, 0]
    };

    if (available === "true") {
      // Caller explicitly wants only available units
      if (search) {
        const re = new RegExp(search, "i");
        query.$and = [
          { $expr: availabilityExpr },
          { $or: [{ title: re }, { location: re }, { county: re }] }
        ];
      } else {
        query.$expr = availabilityExpr;
      }
    } else if (search) {
      // No availability filter — just the text search
      const re = new RegExp(search, "i");
      query.$or = [{ title: re }, { location: re }, { county: re }];
    }

    const cap = Math.min(parseInt(limit) || 100, 500);

    // Check and expire promotions that have ended
    await Property.updateMany(
      {
        isFeatured: true,
        promotionEndDate: { $lt: new Date() }
      },
      {
        $set: {
          isFeatured: false,
          promotionTier: null,
          promotionStartDate: null,
          promotionEndDate: null
        }
      }
    );

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

// ====================== QR CODE SCANS & INQUIRIES ======================

// Log a QR Scan
router.post("/:id/scan", async (req, res) => {
  try {
    const { source = "generic", userAgent, lat, lng } = req.body;
    const propertyId = req.params.id;

    // Check if property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }

    // Capture IP address
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    // Log the scan event
    const scan = new QRScan({
      property: propertyId,
      source,
      userAgent,
      ip,
      location: lat && lng ? { lat, lng } : undefined,
    });
    await scan.save();

    // Increment both views and qrScans
    await Property.findByIdAndUpdate(propertyId, {
      $inc: { views: 1, qrScans: 1 },
    });

    res.status(201).json({
      success: true,
      message: "QR Scan logged successfully",
      scanId: scan._id,
    });
  } catch (error) {
    console.error("❌ Log QR scan error:", error);
    res.status(500).json({ error: "Failed to log QR scan" });
  }
});

// Convert QR Scan to Inquiry (WhatsApp, Call, or Booking)
router.post("/:id/scan/inquiry", async (req, res) => {
  try {
    const { scanId, inquiryType } = req.body;
    const propertyId = req.params.id;

    if (!["whatsapp", "call", "booking"].includes(inquiryType)) {
      return res.status(400).json({ error: "Invalid inquiry type" });
    }

    let scan = null;
    if (scanId) {
      scan = await QRScan.findById(scanId);
    }

    // Fallback: if no scanId was provided or found, find the latest scan for this property from the last 1 hour
    if (!scan) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      scan = await QRScan.findOne({
        property: propertyId,
        scannedAt: { $gte: oneHourAgo },
      }).sort({ scannedAt: -1 });
    }

    if (!scan) {
      // If we still can't find a scan, we still increment property inquiries but can't attribute it to a specific scan document
      await Property.findByIdAndUpdate(propertyId, {
        $inc: { inquiries: 1, qrInquiries: 1 },
      });
      return res.json({ success: true, message: "Inquiry recorded (unattributed)" });
    }

    // If this scan has already been converted to an inquiry, don't double count
    if (scan.convertedToInquiry) {
      return res.json({ success: true, message: "Inquiry already registered for this scan" });
    }

    // Update scan status
    scan.convertedToInquiry = true;
    scan.inquiryType = inquiryType;
    scan.inquiredAt = new Date();
    await scan.save();

    // Increment property counters
    await Property.findByIdAndUpdate(propertyId, {
      $inc: { inquiries: 1, qrInquiries: 1 },
    });

    res.json({ success: true, message: "QR Inquiry recorded successfully" });
  } catch (error) {
    console.error("❌ Convert QR scan error:", error);
    res.status(500).json({ error: "Failed to record QR inquiry" });
  }
});

// Get Detailed QR Statistics for a property (Owner only)
router.get("/:id/qr-stats", auth, async (req, res) => {
  try {
    const propertyId = req.params.id;

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }

    // Verify ownership
    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied. You are not the owner of this property." });
    }

    // Run aggregations
    const totalScans = await QRScan.countDocuments({ property: propertyId });
    const totalInquiries = await QRScan.countDocuments({
      property: propertyId,
      convertedToInquiry: true,
    });

    // Breakdown by source
    const sourceBreakdown = await QRScan.aggregate([
      { $match: { property: new mongoose.Types.ObjectId(propertyId) } },
      { $group: { _id: "$source", count: { $sum: 1 } } },
    ]);

    // Breakdown by inquiry type
    const inquiryTypeBreakdown = await QRScan.aggregate([
      {
        $match: {
          property: new mongoose.Types.ObjectId(propertyId),
          convertedToInquiry: true,
        },
      },
      { $group: { _id: "$inquiryType", count: { $sum: 1 } } },
    ]);

    // Daily scan history (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const dailyHistory = await QRScan.aggregate([
      {
        $match: {
          property: new mongoose.Types.ObjectId(propertyId),
          scannedAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$scannedAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        totalScans,
        totalInquiries,
        conversionRate: totalScans > 0 ? ((totalInquiries / totalScans) * 100).toFixed(1) : "0.0",
        sourceBreakdown: sourceBreakdown.map((item) => ({
          source: item._id,
          count: item.count,
        })),
        inquiryTypeBreakdown: inquiryTypeBreakdown.map((item) => ({
          type: item._id,
          count: item.count,
        })),
        dailyHistory: dailyHistory.map((item) => ({
          date: item._id,
          count: item.count,
        })),
      },
    });
  } catch (error) {
    console.error("❌ Get QR stats error:", error);
    res.status(500).json({ error: "Failed to fetch QR statistics" });
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

// ====================== UPDATE PROPERTY (OWNER OR ADMIN) ======================
router.patch("/:id", auth, upload.array("images", 10), async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: "❌ Property not found" });

    const isOwner = property.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "❌ Access denied. Unauthorized to edit this property." });
    }

    const {
      title, description, location, price, bedrooms, bathrooms,
      amenities, totalUnits, deposit, furnished, leaseType,
      availableFrom, rules, propertyType, county, lat, lng,
      bookedUnits, university, universityId, remainingImages
    } = req.body;

    // Handle amenities array parsing
    let parsedAmenities = [];
    if (amenities) {
      try {
        parsedAmenities = typeof amenities === "string" ? JSON.parse(amenities) : amenities;
      } catch (e) {
        parsedAmenities = Array.isArray(amenities) ? amenities : [];
      }
    }

    // Handle remainingImages array parsing
    let parsedRemainingImages = [];
    if (req.body.hasOwnProperty("remainingImages")) {
      if (remainingImages) {
        try {
          parsedRemainingImages = typeof remainingImages === "string" ? JSON.parse(remainingImages) : remainingImages;
        } catch (e) {
          parsedRemainingImages = Array.isArray(remainingImages) ? remainingImages : [];
        }
      }
    } else {
      parsedRemainingImages = property.images || [];
    }

    // Append newly uploaded images
    const newImageUrls = req.files ? req.files.map((file) => file.path || file.secure_url) : [];
    const updatedImages = [...parsedRemainingImages, ...newImageUrls];

    if (updatedImages.length === 0) {
      return res.status(400).json({ error: "❌ Please keep or upload at least one image" });
    }
    if (updatedImages.length > 10) {
      return res.status(400).json({ error: "❌ Maximum 10 images allowed" });
    }

    // Update property fields if provided
    if (title !== undefined) property.title = title;
    if (description !== undefined) property.description = description;
    if (location !== undefined) property.location = location;
    if (price !== undefined) property.price = parseFloat(price);
    if (bedrooms !== undefined) property.bedrooms = parseInt(bedrooms);
    if (bathrooms !== undefined) property.bathrooms = parseInt(bathrooms);
    if (amenities !== undefined) property.amenities = parsedAmenities;
    if (totalUnits !== undefined) property.totalUnits = parseInt(totalUnits);
    if (deposit !== undefined) property.deposit = deposit ? parseFloat(deposit) : undefined;
    if (furnished !== undefined) property.furnished = furnished === "true" || furnished === true;
    if (leaseType !== undefined) property.leaseType = leaseType;
    if (availableFrom !== undefined) property.availableFrom = availableFrom || undefined;
    if (rules !== undefined) property.rules = rules;
    if (propertyType !== undefined) property.propertyType = propertyType;
    if (county !== undefined) property.county = county;
    if (lat !== undefined) property.lat = lat ? parseFloat(lat) : undefined;
    if (lng !== undefined) property.lng = lng ? parseFloat(lng) : undefined;
    if (bookedUnits !== undefined) property.bookedUnits = parseInt(bookedUnits);
    if (university !== undefined) property.university = university;
    if (universityId !== undefined) property.universityId = universityId;
    property.images = updatedImages;

    // Landlord edits reset status to pending; Admin edits preserve status
    if (!isAdmin) {
      property.status = "pending";
    }

    await property.save();
    console.log(`✅ Property updated successfully | ID: ${property._id} | By: ${req.user._id}`);

    res.json({
      success: true,
      message: isAdmin
        ? "✅ Property updated successfully!"
        : "✅ Property updated successfully! Pending admin approval.",
      property,
    });
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