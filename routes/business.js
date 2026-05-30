import express from "express";
import { auth } from "../middleware/auth.js";
import Business from "../models/Business.js";
import User from "../models/User.js";

const router = express.Router();

// ====================== CREATE BUSINESS ======================
router.post("/", async (req, res) => {
  try {
    const {
      name,
      description,
      categories,
      yearEstablished,
      employeeCount,
      priceRange,
      location,
      contact,
      businessHours,
      socialMedia,
      images,
      submitterName,
    } = req.body;

    console.log("=== BUSINESS SUBMISSION START ===");
    console.log("Business name:", name);
    console.log("Categories:", categories);
    console.log("Submitter name:", submitterName);

    const business = new Business({
      owner: null,
      name,
      description,
      categories,
      yearEstablished: yearEstablished ? parseInt(yearEstablished) : undefined,
      employeeCount,
      priceRange,
      location,
      contact,
      businessHours,
      socialMedia,
      images,
      submitterName,
      isFirstUpload: true,
      status: "pending",
      isApproved: false,
    });

    await business.save();

    console.log("Business saved successfully. ID:", business._id);
    console.log("Is first upload:", business.isFirstUpload); // ← FIX: was `isFirstUpload` (undefined variable)
    console.log("Status:", business.status);
    console.log("=== BUSINESS SUBMISSION END ===");

    res.json({
      success: true,
      message: business.isFirstUpload  // ← FIX: was `isFirstUpload` (undefined variable)
        ? "✅ Business submitted for approval. It will be visible once approved by admin."
        : "✅ Business created successfully and is now visible.",
      business,
    });
  } catch (error) {
    console.error("=== BUSINESS SUBMISSION ERROR ===");
    console.error("Error:", error.message);
    console.error("Stack:", error.stack);
    console.error("===============================");
    res.status(500).json({ error: "Failed to create business", details: error.message });
  }
});

// ====================== GET ALL BUSINESSES ======================
router.get("/", async (req, res) => {
  try {
    const { category, county, search, featured, sort } = req.query;

    const filter = { isApproved: true };

    if (category) {
      filter.categories = category;
    }

    if (county) {
      filter["location.county"] = county;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { categories: { $regex: search, $options: "i" } },
        { "location.town": { $regex: search, $options: "i" } },
      ];
    }

    if (featured === "true") {
      filter.featured = true;
      filter.featuredUntil = { $gt: new Date() };
    }

    let sortOption = { createdAt: -1 };
    switch (sort) {
      case "oldest":
        sortOption = { createdAt: 1 };
        break;
      case "rating":
        sortOption = { rating: -1 };
        break;
      case "views":
        sortOption = { views: -1 };
        break;
      case "name":
        sortOption = { name: 1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    const businesses = await Business.find(filter)
      .populate("owner", "name email phone")
      .sort(sortOption);

    res.json({ success: true, businesses });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch businesses" });
  }
});

// ====================== GET MY BUSINESSES ======================
router.get("/my", auth, async (req, res) => {
  try {
    const businesses = await Business.find({ owner: req.user.id })
      .populate("owner", "name email phone")
      .sort({ createdAt: -1 });

    res.json({ success: true, businesses });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch your businesses" });
  }
});

// ====================== GET ALL ANNOUNCEMENTS ======================
router.get("/announcements", async (req, res) => {
  try {
    const businesses = await Business.find({ status: "approved", "announcements.status": "approved" })
      .select("name announcements")
      .sort({ createdAt: -1 });

    const allAnnouncements = [];
    businesses.forEach(business => {
      business.announcements.forEach(announcement => {
        if (announcement.status === "approved") {
          allAnnouncements.push({
            businessName: business.name,
            businessId: business._id,
            title: announcement.title,
            content: announcement.content,
            createdAt: announcement.createdAt,
          });
        }
      });
    });

    allAnnouncements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, announcements: allAnnouncements });
  } catch (error) {
    console.error("Announcements error:", error);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

// ====================== GET SINGLE BUSINESS ======================
router.get("/:id", async (req, res) => {
  try {
    const business = await Business.findById(req.params.id)
      .populate("owner", "name email phone")
      .populate("verificationBadges.verifiedBy", "name");

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    business.views += 1;
    await business.save();

    res.json({ success: true, business });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch business" });
  }
});

// ====================== UPDATE BUSINESS ======================
router.put("/:id", auth, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    if (business.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to update this business" });
    }

    const {
      name,
      description,
      categories,
      location,
      contact,
      businessHours,
      socialMedia,
      images,
    } = req.body;

    business.name = name || business.name;
    business.description = description || business.description;
    business.categories = categories || business.categories;
    business.location = location || business.location;
    business.contact = contact || business.contact;
    business.businessHours = businessHours || business.businessHours;
    business.socialMedia = socialMedia || business.socialMedia;
    business.images = images || business.images;
    business.updatedAt = Date.now();

    await business.save();

    res.json({ success: true, message: "✅ Business updated successfully", business });
  } catch (error) {
    res.status(500).json({ error: "Failed to update business" });
  }
});

// ====================== DELETE BUSINESS ======================
router.delete("/:id", auth, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    if (business.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to delete this business" });
    }

    await Business.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "✅ Business deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete business" });
  }
});

// ====================== ADD OFFER ======================
router.post("/:id/offers", auth, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    if (business.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to add offers to this business" });
    }

    const { title, description, discount, validUntil } = req.body;

    business.offers.push({ title, description, discount, validUntil });
    await business.save();

    res.json({ success: true, message: "✅ Offer added successfully", business });
  } catch (error) {
    res.status(500).json({ error: "Failed to add offer" });
  }
});

// ====================== ADD ANNOUNCEMENT ======================
router.post("/:id/announcements", auth, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    if (business.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to add announcements to this business" });
    }

    const { title, content } = req.body;

    business.announcements.push({ title, content });
    await business.save();

    res.json({ success: true, message: "✅ Announcement added successfully", business });
  } catch (error) {
    res.status(500).json({ error: "Failed to add announcement" });
  }
});

// ====================== ADMIN: GET PENDING BUSINESSES ======================
router.get("/admin/pending", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "❌ Only admins can view pending businesses" });
    }

    const businesses = await Business.find({ status: "pending" })
      .populate("owner", "name email phone")
      .sort({ createdAt: -1 });

    res.json({ success: true, businesses });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch pending businesses" });
  }
});

// ====================== ADMIN: GET APPROVED BUSINESSES ======================
router.get("/admin/approved", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "❌ Only admins can view approved businesses" });
    }

    const businesses = await Business.find({ status: "approved" })
      .populate("owner", "name email phone")
      .sort({ createdAt: -1 });

    res.json({ success: true, businesses });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch approved businesses" });
  }
});

// ====================== ADMIN: GET REJECTED BUSINESSES ======================
router.get("/admin/rejected", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "❌ Only admins can view rejected businesses" });
    }

    const businesses = await Business.find({ status: "rejected" })
      .populate("owner", "name email phone")
      .sort({ createdAt: -1 });

    res.json({ success: true, businesses });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rejected businesses" });
  }
});

// ====================== ADD GENERAL ANNOUNCEMENT (not tied to business) ======================
router.post("/announcements", async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    // Create a new general announcement
    const announcement = {
      title,
      content,
      status: "pending",
      createdAt: new Date(),
      isGeneral: true,
    };

    // Store in a temporary collection or use the first business as a placeholder
    // For now, we'll use a special business ID for general announcements
    let generalBusiness = await Business.findOne({ name: "General Announcements" });
    if (!generalBusiness) {
      generalBusiness = new Business({
        name: "General Announcements",
        description: "Platform-wide announcements",
        categories: ["General"],
        location: { county: "Nairobi", town: "Nairobi" },
        status: "approved",
        announcements: [],
      });
    }

    generalBusiness.announcements.push(announcement);
    await generalBusiness.save();

    res.json({ success: true, message: "Announcement submitted for approval" });
  } catch (error) {
    console.error("Add general announcement error:", error);
    res.status(500).json({ error: "Failed to add announcement" });
  }
});

// ====================== ADD ANNOUNCEMENT TO BUSINESS ======================
router.post("/:id/announcements", auth, async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    business.announcements.push({
      title,
      content,
      status: "pending",
      createdAt: new Date(),
    });

    await business.save();

    res.json({ success: true, message: "Announcement submitted for approval", business });
  } catch (error) {
    console.error("Add announcement error:", error);
    res.status(500).json({ error: "Failed to add announcement" });
  }
});

// ====================== ADMIN: APPROVE/REJECT ANNOUNCEMENT ======================
router.patch("/admin/:businessId/announcements/:announcementId/status", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "❌ Only admins can approve/reject announcements" });
    }

    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const business = await Business.findById(req.params.businessId);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    const announcement = business.announcements.id(req.params.announcementId);

    if (!announcement) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    announcement.status = status;
    await business.save();

    res.json({ success: true, message: `✅ Announcement ${status} successfully`, business });
  } catch (error) {
    console.error("Approve/reject announcement error:", error);
    res.status(500).json({ error: "Failed to update announcement status" });
  }
});

// ====================== ADMIN: GET PENDING ANNOUNCEMENTS ======================
router.get("/admin/announcements/pending", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "❌ Only admins can view pending announcements" });
    }

    const businesses = await Business.find({ "announcements.status": "pending" })
      .select("name announcements")
      .sort({ createdAt: -1 });

    const pendingAnnouncements = [];
    businesses.forEach(business => {
      business.announcements.forEach(announcement => {
        if (announcement.status === "pending") {
          pendingAnnouncements.push({
            businessName: business.name,
            businessId: business._id,
            announcementId: announcement._id,
            title: announcement.title,
            content: announcement.content,
            createdAt: announcement.createdAt,
          });
        }
      });
    });

    res.json({ success: true, announcements: pendingAnnouncements });
  } catch (error) {
    console.error("Get pending announcements error:", error);
    res.status(500).json({ error: "Failed to fetch pending announcements" });
  }
});

// ====================== ADMIN: APPROVE/REJECT BUSINESS ======================
router.patch("/admin/:id/status", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "❌ Only admins can approve/reject businesses" });
    }

    const { status } = req.body;

    if (!["approved", "rejected", "suspended"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    business.status = status;
    business.isApproved = status === "approved";
    await business.save();

    res.json({ success: true, message: `✅ Business ${status} successfully`, business });
  } catch (error) {
    res.status(500).json({ error: "Failed to update business status" });
  }
});

// ====================== ADMIN: ADD VERIFICATION BADGE ======================
router.post("/admin/:id/verify", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "❌ Only admins can verify businesses" });
    }

    const { badgeType } = req.body;

    const validBadges = [
      "student_verified", "identity_verified", "business_verified",
      "online_verified", "location_verified", "premium_verified",
    ];

    if (!validBadges.includes(badgeType)) {
      return res.status(400).json({ error: "Invalid badge type" });
    }

    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    const existingBadge = business.verificationBadges.find((b) => b.type === badgeType);
    if (existingBadge) {
      return res.status(400).json({ error: "Badge already exists" });
    }

    business.verificationBadges.push({
      type: badgeType,
      verifiedAt: Date.now(),
      verifiedBy: req.user.id,
    });

    await business.save();

    res.json({ success: true, message: `✅ Verification badge added successfully`, business });
  } catch (error) {
    res.status(500).json({ error: "Failed to add verification badge" });
  }
});

// ====================== ADMIN: FEATURE BUSINESS ======================
router.post("/admin/:id/feature", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "❌ Only admins can feature businesses" });
    }

    const { days } = req.body;
    const featuredUntil = new Date();
    featuredUntil.setDate(featuredUntil.getDate() + (days || 30));

    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    business.featured = true;
    business.featuredUntil = featuredUntil;
    await business.save();

    res.json({ success: true, message: `✅ Business featured for ${days || 30} days`, business });
  } catch (error) {
    res.status(500).json({ error: "Failed to feature business" });
  }
});

export default router;