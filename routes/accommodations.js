import express from "express";
import mongoose from "mongoose";
import Accommodation from "../models/Accommodation.js";
import RoomType from "../models/RoomType.js";
import AccommodationImage from "../models/AccommodationImage.js";
import Availability from "../models/Availability.js";
import Booking from "../models/Booking.js";
import Review from "../models/Review.js";
import User from "../models/User.js";
import { auth, adminOnly, authorize, hostOnly } from "../middleware/auth.js";
import upload from "../config/multer.js";
import accommodationUpload from "../config/multerAccommodation.js";
import security from "../middleware/security.js";
import { notifyUser } from "../utils/userNotifications.js";

const router = express.Router();

const uploadAccommodationMedia = (req, res, next) => {
  accommodationUpload.fields([
    { name: "images", maxCount: 20 },
    { name: "videos", maxCount: 10 },
  ])(req, res, (err) => {
    if (err) {
      console.error("Accommodation upload error:", err);
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File too large. Maximum size for media is 100MB." });
      }
      return res.status(400).json({ error: err.message || "File upload failed" });
    }
    next();
  });
};

// ====================== CREATE ACCOMMODATION ======================
router.post("/", auth, uploadAccommodationMedia, async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        error: "User does not exist or invalid token. Please login again."
      });
    }

    const {
      name, type, description, address, lat, lng,
      amenities, houseRules, checkInTime, checkOutTime,
      maxGuests, totalRooms, basePrice, weekendPrice, peakPrice,
      county, town, commonLocation, mapLink, bookingUrl
    } = req.body;

    if (!name || !type || !description || !address || !lat || !lng) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    let parsedAmenities = [];
    try {
      parsedAmenities = amenities ? JSON.parse(amenities) : [];
    } catch (e) {
      parsedAmenities = Array.isArray(amenities) ? amenities : [];
    }

    // Extract image files and video files
    const imageFiles = req.files?.images || [];
    const videoFiles = req.files?.videos || [];

    // Support flat req.files array if provided
    if (Array.isArray(req.files)) {
      req.files.forEach((f) => {
        if (f.mimetype && f.mimetype.startsWith("video/")) {
          videoFiles.push(f);
        } else {
          imageFiles.push(f);
        }
      });
    }

    // Parse any video URLs passed directly in body
    let initialVideos = [];
    if (req.body.videos) {
      try {
        initialVideos = typeof req.body.videos === "string" ? JSON.parse(req.body.videos) : req.body.videos;
      } catch (e) {
        initialVideos = Array.isArray(req.body.videos) ? req.body.videos : [req.body.videos];
      }
      if (!Array.isArray(initialVideos)) initialVideos = [];
    }

    // Collect uploaded video URLs from Cloudinary
    const uploadedVideoUrls = videoFiles.map((file) => file.path || file.secure_url).filter(Boolean);
    const allVideos = [...initialVideos, ...uploadedVideoUrls];

    const accommodation = new Accommodation({
      owner: req.user._id,
      name,
      type,
      description,
      address,
      county: county || "",
      town: town || "",
      commonLocation: commonLocation || "",
      mapLink: mapLink || "",
      bookingUrl: bookingUrl || "",
      location: { lat: parseFloat(lat), lng: parseFloat(lng) },
      amenities: parsedAmenities,
      houseRules: houseRules || "",
      checkInTime: checkInTime || "14:00",
      checkOutTime: checkOutTime || "11:00",
      maxGuests: maxGuests ? parseInt(maxGuests) : 2,
      totalRooms: totalRooms ? parseInt(totalRooms) : 1,
      basePrice: basePrice ? parseFloat(basePrice) : 0,
      weekendPrice: weekendPrice ? parseFloat(weekendPrice) : undefined,
      peakPrice: peakPrice ? parseFloat(peakPrice) : undefined,
      videos: allVideos,
      status: "pending_review",
    });

    await accommodation.save();

    // Handle image uploads
    if (imageFiles.length > 0) {
      const imageUrls = imageFiles.map((file) => file.path || file.secure_url).filter(Boolean);

      for (let i = 0; i < imageUrls.length; i++) {
        const accommodationImage = new AccommodationImage({
          accommodation: accommodation._id,
          imageUrl: imageUrls[i],
          order: i,
          isPrimary: i === 0, // First image is primary
        });
        await accommodationImage.save();
      }
    }

    console.log(`Accommodation created successfully | Owner: ${req.user._id} | Videos: ${allVideos.length} | Images: ${imageFiles.length}`);

    res.status(201).json({
      success: true,
      message: "Accommodation created successfully! Pending admin approval.",
      accommodation: {
        _id: accommodation._id,
        name: accommodation.name,
        status: accommodation.status,
        videos: accommodation.videos,
        createdAt: accommodation.createdAt,
      }
    });

  } catch (error) {
    console.error("Create accommodation error:", error);
    res.status(500).json({ error: error.message || "Failed to create accommodation" });
  }
});

// ====================== ADMIN: GET ACCOMMODATIONS BY STATUS ======================
router.get("/admin/pending", auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};
    if (status) {
      if (status === "pending" || status === "pending_review") {
        query = { status: { $in: ["pending", "pending_review"] } };
      } else if (status === "approved" || status === "active") {
        query = { status: "active" };
      } else if (status === "rejected" || status === "inactive") {
        query = { status: "inactive" };
      } else {
        query = { status };
      }
    }

    const accommodations = await Accommodation.find(query)
      .populate("owner", "name phone email verificationBadges")
      .sort({ createdAt: -1 });

    // Get images for each accommodation
    const accommodationIds = accommodations.map(a => a._id);
    const images = await AccommodationImage.find({ accommodation: { $in: accommodationIds } })
      .sort({ order: 1 });

    const imagesMap = {};
    images.forEach(img => {
      const accIdStr = img.accommodation.toString();
      if (!imagesMap[accIdStr]) {
        imagesMap[accIdStr] = [];
      }
      imagesMap[accIdStr].push(img);
    });

    const processed = accommodations.map(acc => ({
      ...acc.toObject(),
      images: imagesMap[acc._id.toString()] || [],
    }));

    res.json(processed);
  } catch (error) {
    console.error("Get accommodations error:", error);
    res.status(500).json({ error: "Failed to fetch accommodations" });
  }
});

// ====================== ADMIN: UPDATE ACCOMMODATION STATUS ======================
router.patch("/:id/status", auth, adminOnly, async (req, res) => {
  try {
    let { status } = req.body;
    if (status === "approved") status = "active";
    if (status === "rejected") status = "inactive";
    if (status === "pending") status = "pending_review";

    if (!["active", "inactive", "pending_review"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const accommodation = await Accommodation.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate("owner", "name phone email");

    if (!accommodation) {
      return res.status(404).json({ error: "Accommodation not found" });
    }

    if (accommodation.owner) {
      const ownerId = accommodation.owner._id || accommodation.owner;
      if (status === "active") {
        notifyUser(ownerId, {
          type: "accommodation_approved",
          title: "Accommodation Approved! 🎉",
          message: `Your accommodation "${accommodation.name}" has been approved and is now live on AxxSpace!`,
        }).catch(e => console.error("Notify error:", e.message));
      } else if (status === "inactive") {
        notifyUser(ownerId, {
          type: "accommodation_rejected",
          title: "Accommodation Status Update",
          message: `Your accommodation "${accommodation.name}" was not approved at this time. Please review details and resubmit.`,
        }).catch(e => console.error("Notify error:", e.message));
      }
    }

    res.json(accommodation);
  } catch (error) {
    console.error("Update accommodation status error:", error);
    res.status(500).json({ error: "Failed to update accommodation status" });
  }
});

// ====================== GET ALL ACCOMMODATIONS (PUBLIC) ======================
// Supports query params for filtering and search
router.get("/", async (req, res) => {
  try {
    const {
      limit,
      type,
      minPrice,
      maxPrice,
      maxGuests,
      amenities,
      search,
      featured,
      status,
      checkIn,
      checkOut
    } = req.query;

    const query = { status: "active" };

    const resolvedType = type || req.query.category;
    if (resolvedType && resolvedType !== "All") {
      query.type = resolvedType.toLowerCase().replace(/\s+/g, "-");
    }
    if (featured === "true") query.isFeatured = true;
    if (status) query.status = status;

    if (minPrice || maxPrice) {
      query.basePrice = {};
      if (minPrice) query.basePrice.$gte = parseFloat(minPrice);
      if (maxPrice) query.basePrice.$lte = parseFloat(maxPrice);
    }

    if (search) {
      const re = new RegExp(search, "i");
      query.$or = [
        { name: re },
        { description: re },
        { address: re },
      ];
    }

    if (amenities) {
      const amenityList = Array.isArray(amenities) ? amenities : amenities.split(",");
      query.amenities = { $all: amenityList };
    }

    const cap = Math.min(parseInt(limit) || 50, 200);

    // Check and expire promotions that have ended
    await Accommodation.updateMany(
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

    const accommodations = await Accommodation.find(query)
      .populate("owner", "name phone email verificationBadges")
      .sort({ isFeatured: -1, createdAt: -1 })
      .limit(cap);

    // Get images for each accommodation
    const accommodationIds = accommodations.map(a => a._id);
    const images = await AccommodationImage.find({ accommodation: { $in: accommodationIds } })
      .sort({ order: 1 });

    const imagesMap = {};
    images.forEach(img => {
      if (!imagesMap[img.accommodation]) {
        imagesMap[img.accommodation] = [];
      }
      imagesMap[img.accommodation].push(img);
    });

    const processed = accommodations.map(acc => ({
      ...acc.toObject(),
      images: imagesMap[acc._id] || [],
    }));

    res.json(processed);
  } catch (error) {
    console.error("Get accommodations error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch accommodations" });
  }
});

// ====================== OWNER PROFILE ======================
router.get("/owner/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });

    // Get owner's accommodations
    const accommodations = await Accommodation.find({ owner: req.user._id })
      .sort({ createdAt: -1 });

    // Get images for all accommodations
    const accommodationIds = accommodations.map(a => a._id);
    const images = await AccommodationImage.find({ accommodation: { $in: accommodationIds } })
      .sort({ order: 1 });

    const imagesMap = {};
    images.forEach(img => {
      if (!imagesMap[img.accommodation]) {
        imagesMap[img.accommodation] = [];
      }
      imagesMap[img.accommodation].push(img);
    });

    // Calculate stats
    const stats = {
      total: accommodations.length,
      approved: accommodations.filter(a => a.status === "active").length,
      pending: accommodations.filter(a => a.status === "pending_review").length,
      rejected: accommodations.filter(a => a.status === "inactive").length,
      totalViews: accommodations.reduce((sum, a) => sum + (a.views || 0), 0),
    };

    res.json({
      user,
      stats,
      listings: accommodations.map(a => ({
        id: a._id,
        name: a.name,
        category: a.type,
        location: a.address,
        price: a.pricePerNight || 0,
        status: a.status,
        images: imagesMap[a._id]?.map(img => img.imageUrl) || [],
        videos: a.videos || [],
        views: a.views || 0,
        thumbnail: imagesMap[a._id]?.find(img => img.isPrimary)?.imageUrl || null,
        emoji: a.emoji,
      })),
    });
  } catch (error) {
    console.error("Get owner profile error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch profile" });
  }
});

router.patch("/owner/profile", auth, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;

    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: { ...user.toObject(), password: undefined },
    });
  } catch (error) {
    console.error("Update owner profile error:", error);
    res.status(500).json({ error: error.message || "Failed to update profile" });
  }
});

// ====================== MY ACCOMMODATIONS ======================
// This must come before /:id routes
router.get("/my-accommodations/all", auth, async (req, res) => {
  try {
    const accommodations = await Accommodation.find({ owner: req.user._id })
      .sort({ createdAt: -1 });

    const accommodationIds = accommodations.map(a => a._id);
    const images = await AccommodationImage.find({ accommodation: { $in: accommodationIds } })
      .sort({ order: 1 });

    const imagesMap = {};
    images.forEach(img => {
      if (!imagesMap[img.accommodation]) {
        imagesMap[img.accommodation] = [];
      }
      imagesMap[img.accommodation].push(img);
    });

    const processed = accommodations.map(acc => ({
      ...acc.toObject(),
      images: imagesMap[acc._id] || [],
    }));

    res.json(processed);
  } catch (error) {
    console.error("Get my accommodations error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch accommodations" });
  }
});

// ====================== GET SINGLE ACCOMMODATION ======================
router.get("/:id", async (req, res) => {
  try {
    const accommodation = await Accommodation.findById(req.params.id)
      .populate("owner", "name phone email verificationBadges")
      .populate("assignedAgent", "name agentProfile");

    if (!accommodation) return res.status(404).json({ error: "Accommodation not found" });

    // Get images
    const images = await AccommodationImage.find({ accommodation: accommodation._id })
      .sort({ order: 1 });

    // Get room types
    const roomTypes = await RoomType.find({ accommodation: accommodation._id });

    // Get reviews
    const reviews = await Review.find({
      category: "accommodation",
      relatedId: accommodation._id,
      isApproved: true
    })
      .populate("user", "name profileImage")
      .sort({ createdAt: -1 });

    res.json({
      ...accommodation.toObject(),
      images,
      roomTypes,
      reviews,
    });
  } catch (error) {
    console.error("Get single accommodation error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch accommodation" });
  }
});

// ====================== UPDATE ACCOMMODATION (OWNER OR ADMIN) ======================
router.patch("/:id", auth, uploadAccommodationMedia, async (req, res) => {
  try {
    const accommodation = await Accommodation.findById(req.params.id);
    if (!accommodation) return res.status(404).json({ error: "Accommodation not found" });

    const isOwner = accommodation.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Access denied. Unauthorized to edit this accommodation." });
    }

    const {
      name, type, description, address, lat, lng,
      amenities, houseRules, checkInTime, checkOutTime,
      maxGuests, totalRooms, basePrice, weekendPrice, peakPrice,
      county, town, commonLocation, mapLink, bookingUrl,
      remainingImages, removeVideos
    } = req.body;

    let parsedAmenities = [];
    if (amenities) {
      try {
        parsedAmenities = typeof amenities === "string" ? JSON.parse(amenities) : amenities;
      } catch (e) {
        parsedAmenities = Array.isArray(amenities) ? amenities : [];
      }
    }

    // Handle remaining images
    let parsedRemainingImages = [];
    if (Object.prototype.hasOwnProperty.call(req.body, "remainingImages")) {
      if (remainingImages) {
        try {
          parsedRemainingImages = typeof remainingImages === "string" ? JSON.parse(remainingImages) : remainingImages;
        } catch (e) {
          parsedRemainingImages = Array.isArray(remainingImages) ? remainingImages : [];
        }
      }
    }

    // Delete images not in remainingImages
    if (parsedRemainingImages.length > 0) {
      await AccommodationImage.deleteMany({
        accommodation: accommodation._id,
        imageUrl: { $nin: parsedRemainingImages }
      });
    } else if (Object.prototype.hasOwnProperty.call(req.body, "remainingImages")) {
      // If remainingImages is explicitly set to empty array, delete all images
      await AccommodationImage.deleteMany({ accommodation: accommodation._id });
    }

    // Add new images
    const imageFiles = req.files?.images || [];
    const newImageUrls = imageFiles.map((file) => file.path || file.secure_url).filter(Boolean);

    for (let i = 0; i < newImageUrls.length; i++) {
      const accommodationImage = new AccommodationImage({
        accommodation: accommodation._id,
        imageUrl: newImageUrls[i],
        order: (parsedRemainingImages.length + i),
        isPrimary: parsedRemainingImages.length === 0 && i === 0,
      });
      await accommodationImage.save();
    }

    // Handle video removals & new video uploads
    let currentVideos = Array.isArray(accommodation.videos) ? [...accommodation.videos] : [];
    if (removeVideos) {
      let parsedRemoveVideos = [];
      try {
        parsedRemoveVideos = typeof removeVideos === "string" ? JSON.parse(removeVideos) : removeVideos;
      } catch (e) {
        parsedRemoveVideos = Array.isArray(removeVideos) ? removeVideos : [removeVideos];
      }
      currentVideos = currentVideos.filter((v) => !parsedRemoveVideos.includes(v));
    }

    const videoFiles = req.files?.videos || [];
    const newVideoUrls = videoFiles.map((file) => file.path || file.secure_url).filter(Boolean);
    accommodation.videos = [...currentVideos, ...newVideoUrls];

    // Update fields
    if (name !== undefined) accommodation.name = name;
    if (type !== undefined) accommodation.type = type;
    if (description !== undefined) accommodation.description = description;
    if (address !== undefined) accommodation.address = address;
    if (county !== undefined) accommodation.county = county;
    if (town !== undefined) accommodation.town = town;
    if (commonLocation !== undefined) accommodation.commonLocation = commonLocation;
    if (mapLink !== undefined) accommodation.mapLink = mapLink;
    if (bookingUrl !== undefined) accommodation.bookingUrl = bookingUrl;
    if (lat !== undefined && !isNaN(parseFloat(lat))) accommodation.location.lat = parseFloat(lat);
    if (lng !== undefined && !isNaN(parseFloat(lng))) accommodation.location.lng = parseFloat(lng);
    if (amenities !== undefined) accommodation.amenities = parsedAmenities;
    if (houseRules !== undefined) accommodation.houseRules = houseRules;
    if (checkInTime !== undefined) accommodation.checkInTime = checkInTime;
    if (checkOutTime !== undefined) accommodation.checkOutTime = checkOutTime;
    if (maxGuests !== undefined) accommodation.maxGuests = parseInt(maxGuests);
    if (totalRooms !== undefined) accommodation.totalRooms = parseInt(totalRooms);
    if (basePrice !== undefined) accommodation.basePrice = parseFloat(basePrice);
    if (weekendPrice !== undefined) accommodation.weekendPrice = parseFloat(weekendPrice);
    if (peakPrice !== undefined) accommodation.peakPrice = parseFloat(peakPrice);

    // Landlord edits reset status to pending_review; Admin edits preserve status
    if (!isAdmin) {
      accommodation.status = "pending_review";
    }

    await accommodation.save();
    console.log(`Accommodation updated successfully | ID: ${accommodation._id} | By: ${req.user._id} | Videos: ${accommodation.videos.length}`);

    res.json({
      success: true,
      message: isAdmin
        ? "Accommodation updated successfully!"
        : "Accommodation updated successfully! Pending admin approval.",
      accommodation,
    });
  } catch (error) {
    console.error("Update accommodation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ====================== DELETE ACCOMMODATION (OWNER OR ADMIN) ======================
router.delete("/:id", auth, async (req, res) => {
  try {
    const accommodation = await Accommodation.findById(req.params.id);
    if (!accommodation) return res.status(404).json({ error: "Accommodation not found" });

    const isOwner = accommodation.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Access denied. Unauthorized to delete this accommodation." });
    }

    // Check for active bookings
    const activeBookings = await Booking.countDocuments({
      accommodation: accommodation._id,
      status: { $in: ["pending", "confirmed"] }
    });

    if (activeBookings > 0) {
      return res.status(400).json({ error: "Cannot delete accommodation with active bookings." });
    }

    // Delete related data
    await AccommodationImage.deleteMany({ accommodation: accommodation._id });
    await RoomType.deleteMany({ accommodation: accommodation._id });
    await Availability.deleteMany({ accommodation: accommodation._id });
    await Booking.deleteMany({ accommodation: accommodation._id });
    await Review.deleteMany({ category: "accommodation", relatedId: accommodation._id });

    await Accommodation.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Accommodation deleted successfully" });
  } catch (error) {
    console.error("Delete accommodation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ====================== ROOM TYPES ======================

// Create room type
router.post("/:id/room-types", auth, async (req, res) => {
  try {
    const accommodation = await Accommodation.findById(req.params.id);
    if (!accommodation) return res.status(404).json({ error: "Accommodation not found" });

    if (accommodation.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied. You are not the owner of this accommodation." });
    }

    const {
      name, capacity, pricePerNight, quantity, amenities, description, size, bedType
    } = req.body;

    if (!name || !capacity || !pricePerNight || !quantity) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    let parsedAmenities = [];
    try {
      parsedAmenities = amenities ? JSON.parse(amenities) : [];
    } catch (e) {
      parsedAmenities = Array.isArray(amenities) ? amenities : [];
    }

    const roomType = new RoomType({
      accommodation: accommodation._id,
      name,
      capacity: parseInt(capacity),
      pricePerNight: parseFloat(pricePerNight),
      quantity: parseInt(quantity),
      amenities: parsedAmenities,
      description: description || "",
      size: size || "",
      bedType: bedType || "",
    });

    await roomType.save();

    // Initialize availability for next 90 days
    const today = new Date();
    for (let i = 0; i < 90; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      const availability = new Availability({
        roomType: roomType._id,
        date: date,
        availableUnits: parseInt(quantity),
        price: parseFloat(pricePerNight),
      });
      await availability.save();
    }

    res.status(201).json({
      success: true,
      message: "Room type created successfully",
      roomType,
    });
  } catch (error) {
    console.error("Create room type error:", error);
    res.status(500).json({ error: error.message || "Failed to create room type" });
  }
});

// Get room types for accommodation
router.get("/:id/room-types", async (req, res) => {
  try {
    const roomTypes = await RoomType.find({ accommodation: req.params.id })
      .sort({ createdAt: -1 });

    // Get availability for each room type
    const roomTypeIds = roomTypes.map(rt => rt._id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const availability = await Availability.find({
      roomType: { $in: roomTypeIds },
      date: { $gte: today }
    }).sort({ date: 1 });

    const availabilityMap = {};
    availability.forEach(avail => {
      if (!availabilityMap[avail.roomType]) {
        availabilityMap[avail.roomType] = [];
      }
      availabilityMap[avail.roomType].push(avail);
    });

    const processed = roomTypes.map(rt => ({
      ...rt.toObject(),
      availability: availabilityMap[rt._id] || [],
    }));

    res.json(processed);
  } catch (error) {
    console.error("Get room types error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch room types" });
  }
});

// Update room type
router.patch("/room-types/:roomTypeId", auth, async (req, res) => {
  try {
    const roomType = await RoomType.findById(req.params.roomTypeId);
    if (!roomType) return res.status(404).json({ error: "Room type not found" });

    const accommodation = await Accommodation.findById(roomType.accommodation);
    if (accommodation.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied. You are not the owner of this accommodation." });
    }

    const {
      name, capacity, pricePerNight, quantity, amenities, description, size, bedType
    } = req.body;

    let parsedAmenities = [];
    if (amenities) {
      try {
        parsedAmenities = typeof amenities === "string" ? JSON.parse(amenities) : amenities;
      } catch (e) {
        parsedAmenities = Array.isArray(amenities) ? amenities : [];
      }
    }

    if (name !== undefined) roomType.name = name;
    if (capacity !== undefined) roomType.capacity = parseInt(capacity);
    if (pricePerNight !== undefined) roomType.pricePerNight = parseFloat(pricePerNight);
    if (quantity !== undefined) roomType.quantity = parseInt(quantity);
    if (amenities !== undefined) roomType.amenities = parsedAmenities;
    if (description !== undefined) roomType.description = description;
    if (size !== undefined) roomType.size = size;
    if (bedType !== undefined) roomType.bedType = bedType;

    await roomType.save();

    res.json({
      success: true,
      message: "Room type updated successfully",
      roomType,
    });
  } catch (error) {
    console.error("Update room type error:", error);
    res.status(500).json({ error: error.message || "Failed to update room type" });
  }
});

// Delete room type
router.delete("/room-types/:roomTypeId", auth, async (req, res) => {
  try {
    const roomType = await RoomType.findById(req.params.roomTypeId);
    if (!roomType) return res.status(404).json({ error: "Room type not found" });

    const accommodation = await Accommodation.findById(roomType.accommodation);
    if (accommodation.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied. You are not the owner of this accommodation." });
    }

    // Check for active bookings
    const activeBookings = await Booking.countDocuments({
      roomType: roomType._id,
      status: { $in: ["pending", "confirmed"] }
    });

    if (activeBookings > 0) {
      return res.status(400).json({ error: "Cannot delete room type with active bookings." });
    }

    await Availability.deleteMany({ roomType: roomType._id });
    await RoomType.findByIdAndDelete(req.params.roomTypeId);

    res.json({ success: true, message: "Room type deleted successfully" });
  } catch (error) {
    console.error("Delete room type error:", error);
    res.status(500).json({ error: error.message || "Failed to delete room type" });
  }
});

// ====================== AVAILABILITY MANAGEMENT ======================

// Update availability for specific date
router.patch("/room-types/:roomTypeId/availability", auth, async (req, res) => {
  try {
    const roomType = await RoomType.findById(req.params.roomTypeId);
    if (!roomType) return res.status(404).json({ error: "Room type not found" });

    const accommodation = await Accommodation.findById(roomType.accommodation);
    if (accommodation.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied. You are not the owner of this accommodation." });
    }

    const { date, availableUnits, price, isBlocked } = req.body;

    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    const availability = await Availability.findOneAndUpdate(
      { roomType: roomType._id, date: dateObj },
      {
        availableUnits: availableUnits !== undefined ? parseInt(availableUnits) : undefined,
        price: price !== undefined ? parseFloat(price) : undefined,
        isBlocked: isBlocked !== undefined ? isBlocked : undefined,
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: "Availability updated successfully",
      availability,
    });
  } catch (error) {
    console.error("Update availability error:", error);
    res.status(500).json({ error: error.message || "Failed to update availability" });
  }
});

// Bulk update availability
router.post("/room-types/:roomTypeId/availability/bulk", auth, async (req, res) => {
  try {
    const roomType = await RoomType.findById(req.params.roomTypeId);
    if (!roomType) return res.status(404).json({ error: "Room type not found" });

    const accommodation = await Accommodation.findById(roomType.accommodation);
    if (accommodation.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied. You are not the owner of this accommodation." });
    }

    const { startDate, endDate, availableUnits, price, isBlocked } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Start date and end date are required" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const bulkOps = [];
    const current = new Date(start);

    while (current <= end) {
      bulkOps.push({
        updateOne: {
          filter: { roomType: roomType._id, date: current },
          update: {
            $set: {
              availableUnits: availableUnits !== undefined ? parseInt(availableUnits) : undefined,
              price: price !== undefined ? parseFloat(price) : undefined,
              isBlocked: isBlocked !== undefined ? isBlocked : undefined,
            }
          },
          upsert: true
        }
      });
      current.setDate(current.getDate() + 1);
    }

    await Availability.bulkWrite(bulkOps);

    res.json({
      success: true,
      message: "Bulk availability updated successfully",
    });
  } catch (error) {
    console.error("Bulk update availability error:", error);
    res.status(500).json({ error: error.message || "Failed to update availability" });
  }
});

export default router;
