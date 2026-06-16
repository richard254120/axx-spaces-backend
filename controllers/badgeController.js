import Property from "../models/Property.js";
import Material from "../models/Material.js";
import TourismListing from "../models/TourismListing.js";
import Business from "../models/Business.js";
import User from "../models/User.js";

// ====================== ISSUE BADGE TO LISTING ======================
export const issueBadge = async (req, res) => {
  try {
    const { listingType, listingId, badgeType } = req.body;
    const adminId = req.user._id;

    // Validate badge type
    const validBadgeTypes = [
      "premium_verified",
      "student_verified",
      "business_verified",
      "identity_verified",
      "location_verified",
      "online_verified",
    ];

    if (!validBadgeTypes.includes(badgeType)) {
      return res.status(400).json({ error: "Invalid badge type" });
    }

    let listing;
    let listingModel;

    // Find the listing based on type
    switch (listingType) {
      case "property":
        listing = await Property.findById(listingId);
        listingModel = Property;
        break;
      case "material":
        listing = await Material.findById(listingId);
        listingModel = Material;
        break;
      case "tourism":
        listing = await TourismListing.findById(listingId);
        listingModel = TourismListing;
        break;
      case "business":
        listing = await Business.findById(listingId);
        listingModel = Business;
        break;
      default:
        return res.status(400).json({ error: "Invalid listing type" });
    }

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    // Check if badge already exists
    const existingBadge = listing.verificationBadges?.find(
      (badge) => badge.type === badgeType
    );

    if (existingBadge) {
      return res.status(400).json({ error: "Badge already issued to this listing" });
    }

    // Add the badge
    const newBadge = {
      type: badgeType,
      verifiedAt: new Date(),
      verifiedBy: adminId,
    };

    if (!listing.verificationBadges) {
      listing.verificationBadges = [];
    }

    listing.verificationBadges.push(newBadge);
    await listing.save();

    // Populate the verifiedBy field
    await listing.populate("verificationBadges.verifiedBy", "name email");

    res.json({
      success: true,
      message: `Badge ${badgeType} issued successfully`,
      listing,
    });
  } catch (error) {
    console.error("❌ Issue badge error:", error);
    res.status(500).json({ error: error.message || "Failed to issue badge" });
  }
};

// ====================== REMOVE BADGE FROM LISTING ======================
export const removeBadge = async (req, res) => {
  try {
    const { listingType, listingId, badgeType } = req.body;

    let listing;
    let listingModel;

    // Find the listing based on type
    switch (listingType) {
      case "property":
        listing = await Property.findById(listingId);
        listingModel = Property;
        break;
      case "material":
        listing = await Material.findById(listingId);
        listingModel = Material;
        break;
      case "tourism":
        listing = await TourismListing.findById(listingId);
        listingModel = TourismListing;
        break;
      case "business":
        listing = await Business.findById(listingId);
        listingModel = Business;
        break;
      default:
        return res.status(400).json({ error: "Invalid listing type" });
    }

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    // Remove the badge
    listing.verificationBadges = listing.verificationBadges.filter(
      (badge) => badge.type !== badgeType
    );

    await listing.save();

    res.json({
      success: true,
      message: `Badge ${badgeType} removed successfully`,
      listing,
    });
  } catch (error) {
    console.error("❌ Remove badge error:", error);
    res.status(500).json({ error: error.message || "Failed to remove badge" });
  }
};

// ====================== GET LISTING BADGES ======================
export const getListingBadges = async (req, res) => {
  try {
    const { listingType, listingId } = req.params;

    let listing;

    // Find the listing based on type
    switch (listingType) {
      case "property":
        listing = await Property.findById(listingId).populate(
          "verificationBadges.verifiedBy",
          "name email"
        );
        break;
      case "material":
        listing = await Material.findById(listingId).populate(
          "verificationBadges.verifiedBy",
          "name email"
        );
        break;
      case "tourism":
        listing = await TourismListing.findById(listingId).populate(
          "verificationBadges.verifiedBy",
          "name email"
        );
        break;
      case "business":
        listing = await Business.findById(listingId).populate(
          "verificationBadges.verifiedBy",
          "name email"
        );
        break;
      default:
        return res.status(400).json({ error: "Invalid listing type" });
    }

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    res.json({
      success: true,
      badges: listing.verificationBadges || [],
    });
  } catch (error) {
    console.error("❌ Get listing badges error:", error);
    res.status(500).json({ error: error.message || "Failed to get badges" });
  }
};

// ====================== GET ALL BADGES BY ADMIN ======================
export const getAllBadges = async (req, res) => {
  try {
    const { listingType, badgeType } = req.query;

    let query = {};
    if (badgeType) {
      query["verificationBadges.type"] = badgeType;
    }

    let listings = [];

    switch (listingType) {
      case "property":
        listings = await Property.find(query)
          .populate("verificationBadges.verifiedBy", "name email")
          .populate("owner", "name email")
          .sort({ createdAt: -1 });
        break;
      case "material":
        listings = await Material.find(query)
          .populate("verificationBadges.verifiedBy", "name email")
          .populate("seller", "name email")
          .sort({ createdAt: -1 });
        break;
      case "tourism":
        listings = await TourismListing.find(query)
          .populate("verificationBadges.verifiedBy", "name email")
          .populate("owner", "name email")
          .sort({ createdAt: -1 });
        break;
      case "business":
        listings = await Business.find(query)
          .populate("verificationBadges.verifiedBy", "name email")
          .populate("owner", "name email")
          .sort({ createdAt: -1 });
        break;
      default:
        // Get all types
        const [properties, materials, tourism, businesses] = await Promise.all([
          Property.find(query)
            .populate("verificationBadges.verifiedBy", "name email")
            .populate("owner", "name email")
            .sort({ createdAt: -1 }),
          Material.find(query)
            .populate("verificationBadges.verifiedBy", "name email")
            .populate("seller", "name email")
            .sort({ createdAt: -1 }),
          TourismListing.find(query)
            .populate("verificationBadges.verifiedBy", "name email")
            .populate("owner", "name email")
            .sort({ createdAt: -1 }),
          Business.find(query)
            .populate("verificationBadges.verifiedBy", "name email")
            .populate("owner", "name email")
            .sort({ createdAt: -1 }),
        ]);

        listings = [
          ...properties.map((item) => ({ ...item.toObject(), listingType: "property" })),
          ...materials.map((item) => ({ ...item.toObject(), listingType: "material" })),
          ...tourism.map((item) => ({ ...item.toObject(), listingType: "tourism" })),
          ...businesses.map((item) => ({ ...item.toObject(), listingType: "business" })),
        ];
    }

    // Filter listings that have badges
    const listingsWithBadges = listingType
      ? listings.filter((item) => item.verificationBadges && item.verificationBadges.length > 0)
      : listings;

    res.json({
      success: true,
      listings: listingsWithBadges,
      count: listingsWithBadges.length,
    });
  } catch (error) {
    console.error("❌ Get all badges error:", error);
    res.status(500).json({ error: error.message || "Failed to get badges" });
  }
};

// ====================== GET BADGE STATISTICS ======================
export const getBadgeStats = async (req, res) => {
  try {
    const badgeTypes = [
      "premium_verified",
      "student_verified",
      "business_verified",
      "identity_verified",
      "location_verified",
      "online_verified",
    ];

    const stats = {};

    for (const badgeType of badgeTypes) {
      const [properties, materials, tourism, businesses] = await Promise.all([
        Property.countDocuments({ "verificationBadges.type": badgeType }),
        Material.countDocuments({ "verificationBadges.type": badgeType }),
        TourismListing.countDocuments({ "verificationBadges.type": badgeType }),
        Business.countDocuments({ "verificationBadges.type": badgeType }),
      ]);

      stats[badgeType] = {
        properties,
        materials,
        tourism,
        businesses,
        total: properties + materials + tourism + businesses,
      };
    }

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("❌ Get badge stats error:", error);
    res.status(500).json({ error: error.message || "Failed to get badge statistics" });
  }
};
