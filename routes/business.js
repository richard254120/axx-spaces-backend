import express from "express";
import { auth } from "../middleware/auth.js";
import Business from "../models/Business.js";
import User from "../models/User.js";

const router = express.Router();

// ====================== CREATE BUSINESS ======================
router.post("/", auth, async (req, res) => {
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
      logo,
      products,
      pricelist,
      submitterName,
    } = req.body;

    console.log("=== BUSINESS SUBMISSION START ===");
    console.log("Business name:", name);
    console.log("Categories:", categories);
    console.log("Submitter name:", submitterName);
    console.log("User ID:", req.user?.id);
    console.log("Images:", images);
    console.log("Images length:", images?.length);

    const business = new Business({
      owner: req.user?.id || null,
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
      logo,
      products,
      pricelist,
      submitterName,
      isFirstUpload: true,
      status: "pending",
      isApproved: false,
    });

    await business.save();

    console.log("Business saved successfully. ID:", business._id);
    console.log("Is first upload:", business.isFirstUpload);
    console.log("Status:", business.status);
    console.log("Owner:", business.owner);
    console.log("=== BUSINESS SUBMISSION END ===");

    res.json({
      success: true,
      message: business.isFirstUpload
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
    const { category, county, search, featured, sort, minRating, maxRating, priceRange, openNow, verification } = req.query;

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

    if (minRating) {
      filter.rating = { $gte: parseFloat(minRating) };
    }

    if (maxRating) {
      if (!filter.rating) filter.rating = {};
      filter.rating.$lte = parseFloat(maxRating);
    }

    if (priceRange) {
      filter.priceRange = priceRange;
    }

    if (openNow === "true") {
      const now = new Date();
      const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

      filter[`businessHours.${currentDay}.closed`] = false;
    }

    if (verification) {
      filter["verificationBadges.type"] = verification;
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
      case "reviews":
        sortOption = { reviewCount: -1 };
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
    console.log("=== GET ANNOUNCEMENTS START ===");
    // Find all businesses that have announcements (regardless of business status)
    const businesses = await Business.find({ "announcements.0": { $exists: true } })
      .select("name announcements")
      .sort({ createdAt: -1 });

    console.log(`Found ${businesses.length} businesses with announcements`);

    const allAnnouncements = [];
    businesses.forEach(business => {
      business.announcements.forEach(announcement => {
        console.log(`Announcement: ${announcement.title}, Status: ${announcement.status}`);
        if (announcement.status === "approved") {
          allAnnouncements.push({
            businessName: business.name,
            businessId: business._id,
            title: announcement.title,
            content: announcement.content,
            submitterName: announcement.submitterName,
            organizationName: announcement.organizationName,
            createdAt: announcement.createdAt,
          });
        }
      });
    });

    console.log(`Total approved announcements: ${allAnnouncements.length}`);
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
    console.log("=== ANNOUNCEMENT SUBMISSION START ===");
    console.log("Request body:", req.body);

    const { title, content, submitterName, organizationName } = req.body;

    if (!title || !content) {
      console.log("Validation failed: Missing title or content");
      return res.status(400).json({ error: "Title and content are required" });
    }

    // Create a new general announcement
    const announcement = {
      title,
      content,
      submitterName,
      organizationName,
      status: "pending",
      createdAt: new Date(),
      isGeneral: true,
    };

    console.log("Looking for General Announcements business...");
    // Store in a temporary collection or use the first business as a placeholder
    // For now, we'll use a special business ID for general announcements
    let generalBusiness = await Business.findOne({ name: "General Announcements" });
    if (!generalBusiness) {
      console.log("Creating General Announcements business...");
      generalBusiness = new Business({
        name: "General Announcements",
        description: "Platform-wide announcements",
        categories: ["General"],
        location: { county: "Nairobi", town: "Nairobi" },
        contact: { phone: "0000000000" },
        status: "approved",
        isApproved: true,
        announcements: [],
      });
    }

    console.log("Adding announcement to business...");
    generalBusiness.announcements.push(announcement);
    await generalBusiness.save();

    console.log("Announcement saved successfully");
    res.json({ success: true, message: "Announcement submitted for approval" });
  } catch (error) {
    console.error("=== ANNOUNCEMENT SUBMISSION ERROR ===");
    console.error("Error:", error.message);
    console.error("Stack:", error.stack);
    res.status(500).json({ error: "Failed to add announcement", details: error.message });
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

// ====================== ADMIN: GET ALL ANNOUNCEMENTS ======================
router.get("/admin/announcements", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "❌ Only admins can view announcements" });
    }

    const businesses = await Business.find({ "announcements.0": { $exists: true } })
      .select("name announcements")
      .sort({ createdAt: -1 });

    const allAnnouncements = [];
    businesses.forEach(business => {
      business.announcements.forEach(announcement => {
        allAnnouncements.push({
          businessName: business.name,
          businessId: business._id,
          announcementId: announcement._id,
          title: announcement.title,
          content: announcement.content,
          submitterName: announcement.submitterName,
          organizationName: announcement.organizationName,
          status: announcement.status,
          createdAt: announcement.createdAt,
        });
      });
    });

    allAnnouncements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, announcements: allAnnouncements });
  } catch (error) {
    console.error("Get announcements error:", error);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

// ====================== ADMIN: APPROVE/REJECT ANNOUNCEMENT ======================
router.patch("/admin/announcements/:businessId/:announcementIndex", auth, async (req, res) => {
  try {
    console.log("=== APPROVE/REJECT ANNOUNCEMENT START ===");
    console.log("Request params:", req.params);
    console.log("Request body:", req.body);

    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "❌ Only admins can moderate announcements" });
    }

    const { businessId, announcementIndex } = req.params;
    const { status, title, createdAt } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    console.log(`Business found: ${business.name}, Total announcements: ${business.announcements.length}`);

    // Find the announcement by title and createdAt to handle filtered arrays
    const announcement = business.announcements.find(
      a => a.title === title && new Date(a.createdAt).getTime() === new Date(createdAt).getTime()
    );

    if (!announcement) {
      console.log("Announcement not found with provided title and createdAt");
      return res.status(404).json({ error: "Announcement not found" });
    }

    console.log(`Announcement found: ${announcement.title}, Current status: ${announcement.status}`);
    announcement.status = status;
    console.log(`Updated status to: ${status}`);
    await business.save();

    res.json({ success: true, message: `Announcement ${status} successfully` });
  } catch (error) {
    console.error("Moderate announcement error:", error);
    res.status(500).json({ error: "Failed to moderate announcement" });
  }
});

// ====================== ADMIN: DELETE ANNOUNCEMENT ======================
router.delete("/admin/:businessId/announcements/:announcementId", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "❌ Only admins can delete announcements" });
    }

    const { businessId, announcementId } = req.params;

    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    business.announcements = business.announcements.filter(
      announcement => announcement._id.toString() !== announcementId
    );

    await business.save();

    res.json({ success: true, message: "✅ Announcement deleted successfully" });
  } catch (error) {
    console.error("Delete announcement error:", error);
    res.status(500).json({ error: "Failed to delete announcement" });
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

    const { badgeType, tier, documents } = req.body;

    const validBadges = [
      "student_verified", "identity_verified", "business_verified",
      "online_verified", "location_verified", "premium_verified",
      "bronze", "silver", "gold",
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
      tier: tier || "basic",
      verifiedAt: Date.now(),
      verifiedBy: req.user.id,
      documents: documents || [],
    });

    await business.save();

    res.json({ success: true, message: `✅ Verification badge added successfully`, business });
  } catch (error) {
    res.status(500).json({ error: "Failed to add verification badge" });
  }
});

// ====================== UPLOAD VIDEO TOUR ======================
router.post("/:id/video-tour", auth, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    if (business.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to upload video tour" });
    }

    const { url, thumbnail, duration } = req.body;

    business.videoTour = {
      url,
      thumbnail,
      duration,
    };

    await business.save();

    res.json({ success: true, message: "Video tour uploaded successfully", business });
  } catch (error) {
    console.error("Upload video tour error:", error);
    res.status(500).json({ error: "Failed to upload video tour" });
  }
});

// ====================== UPLOAD DOCUMENT ======================
router.post("/:id/documents", auth, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    if (business.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to upload documents" });
    }

    const { type, url, name } = req.body;

    business.documents.push({
      type,
      url,
      name,
      verified: false,
    });

    await business.save();

    res.json({ success: true, message: "Document uploaded successfully", business });
  } catch (error) {
    console.error("Upload document error:", error);
    res.status(500).json({ error: "Failed to upload document" });
  }
});

// ====================== GENERATE QR CODE ======================
router.get("/:id/qr-code", async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    const businessUrl = `https://axxspace.com/business/${business._id}`;

    // Generate QR code (using a simple approach - in production, use a QR code library)
    const qrCodeData = {
      businessId: business._id,
      businessName: business.name,
      url: businessUrl,
      generatedAt: new Date(),
    };

    res.json({ success: true, qrCodeData });
  } catch (error) {
    console.error("Generate QR code error:", error);
    res.status(500).json({ error: "Failed to generate QR code" });
  }
});

// ====================== ADD EVENT TO BUSINESS ======================
router.post("/:id/events", auth, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    if (business.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to add events to this business" });
    }

    const { title, description, startDate, endDate, location, imageUrl, isFeatured } = req.body;

    business.events.push({
      title,
      description,
      startDate,
      endDate,
      location,
      imageUrl,
      isFeatured: isFeatured || false,
      status: "upcoming",
    });

    await business.save();

    res.json({ success: true, message: "Event added successfully", business });
  } catch (error) {
    console.error("Add event error:", error);
    res.status(500).json({ error: "Failed to add event" });
  }
});

// ====================== ADD PROMOTION TO BUSINESS ======================
router.post("/:id/promotions", auth, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    if (business.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to add promotions to this business" });
    }

    const { title, description, discountType, discountValue, startDate, endDate, terms, imageUrl, code, isFeatured } = req.body;

    business.promotions.push({
      title,
      description,
      discountType: discountType || "percentage",
      discountValue,
      startDate,
      endDate,
      terms,
      imageUrl,
      code,
      isFeatured: isFeatured || false,
      status: "active",
    });

    await business.save();

    res.json({ success: true, message: "Promotion added successfully", business });
  } catch (error) {
    console.error("Add promotion error:", error);
    res.status(500).json({ error: "Failed to add promotion" });
  }
});

// ====================== GET ALL EVENTS ======================
router.get("/events/all", async (req, res) => {
  try {
    const { status, featured } = req.query;
    const filter = { isApproved: true };

    if (status) filter["events.status"] = status;
    if (featured === "true") filter["events.isFeatured"] = true;

    const businesses = await Business.find(filter)
      .select("name events")
      .sort({ createdAt: -1 });

    const allEvents = [];
    businesses.forEach(business => {
      business.events.forEach(event => {
        if ((!status || event.status === status) && (!featured || event.isFeatured)) {
          allEvents.push({
            businessName: business.name,
            businessId: business._id,
            ...event.toObject(),
          });
        }
      });
    });

    allEvents.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    res.json({ success: true, events: allEvents });
  } catch (error) {
    console.error("Get events error:", error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// ====================== COMPARE BUSINESSES ======================
router.get("/compare", async (req, res) => {
  try {
    console.log("=== COMPARE BUSINESSES START ===");
    console.log("Request query:", req.query);

    const { ids } = req.query;

    if (!ids) {
      return res.status(400).json({ error: "Business IDs are required" });
    }

    const businessIds = ids.split(",");
    console.log("Business IDs to compare:", businessIds);

    const businesses = await Business.find({
      _id: { $in: businessIds },
      status: "approved",
    })
      .populate("owner", "name email phone")
      .select("name description categories location contact rating reviewCount priceRange employeeCount yearEstablished verificationBadges images");

    console.log(`Found ${businesses.length} businesses for comparison`);

    if (businesses.length === 0) {
      return res.status(404).json({ error: "No businesses found" });
    }

    res.json({ success: true, businesses });
  } catch (error) {
    console.error("Compare businesses error:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ error: "Failed to compare businesses" });
  }
});

// ====================== GET ALL PROMOTIONS ======================
router.get("/promotions/all", async (req, res) => {
  try {
    const { status, featured } = req.query;
    const filter = { isApproved: true };

    if (status) filter["promotions.status"] = status;
    if (featured === "true") filter["promotions.isFeatured"] = true;

    const businesses = await Business.find(filter)
      .select("name promotions")
      .sort({ createdAt: -1 });

    const allPromotions = [];
    businesses.forEach(business => {
      business.promotions.forEach(promotion => {
        if ((!status || promotion.status === status) && (!featured || promotion.isFeatured)) {
          allPromotions.push({
            businessName: business.name,
            businessId: business._id,
            ...promotion.toObject(),
          });
        }
      });
    });

    allPromotions.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    res.json({ success: true, promotions: allPromotions });
  } catch (error) {
    console.error("Get promotions error:", error);
    res.status(500).json({ error: "Failed to fetch promotions" });
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