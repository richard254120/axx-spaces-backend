import express from "express";
import Property from "../models/Property.js";
import Material from "../models/Material.js";
import User from "../models/User.js";
import TourismListing from "../models/TourismListing.js";
import SellerVerification from "../models/SellerVerification.js";
import Business from "../models/Business.js";
import Notification from "../models/Notification.js";
import { protect, adminOnly } from "../middleware/auth.js";
import { sendPropertyApprovalEmail, sendMaterialApprovalEmail, sendTourismApprovalEmail, sendMoverApprovalEmail } from "../utils/email.js";

const router = express.Router();

// ====================== GET ALL PENDING ITEMS ======================
router.get("/pending", protect, adminOnly, async (req, res) => {
  try {
    const [pendingProperties, pendingMaterials, pendingTourism, pendingMovers, pendingSellers, pendingBusinesses] = await Promise.all([
      Property.find({ status: "pending" }).populate("owner", "name email phone").sort({ createdAt: -1 }),
      Material.find({ status: "pending" }).populate("seller", "name email phone").sort({ createdAt: -1 }),
      TourismListing.find({ status: "pending" }).populate("owner", "name email phone").sort({ createdAt: -1 }),
      User.find({ role: "mover", status: "pending" }).sort({ createdAt: -1 }),
      SellerVerification.find({ status: "pending" }).populate("seller", "name email phone").sort({ createdAt: -1 }),
      Business.find({ status: "pending" }).populate("owner", "name email phone").sort({ createdAt: -1 }),
    ]);

    res.json({
      properties: pendingProperties,
      materials: pendingMaterials,
      tourism: pendingTourism,
      movers: pendingMovers,
      sellers: pendingSellers,
      businesses: pendingBusinesses,
    });
  } catch (error) {
    console.error("❌ Get pending items error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch pending items" });
  }
});

// ====================== GET ALL ITEMS (for admin overview) ======================
router.get("/all", protect, adminOnly, async (req, res) => {
  try {
    const { type, status } = req.query;

    let data;
    switch (type) {
      case "properties":
        data = await Property.find(status ? { status } : {})
          .populate("owner", "name email phone")
          .sort({ createdAt: -1 });
        break;
      case "materials":
        // ✅ FIXED: Map "approved" status to "active" for materials
        const materialStatus = status === "approved" ? "active" : status;
        data = await Material.find(materialStatus ? { status: materialStatus } : {})
          .populate("seller", "name email phone")
          .sort({ createdAt: -1 });
        break;
      case "tourism":
        data = await TourismListing.find(status ? { status } : {})
          .populate("owner", "name email phone")
          .sort({ createdAt: -1 });
        break;
      case "movers":
        data = await User.find({ role: "mover", ...(status ? { status } : {}) })
          .sort({ createdAt: -1 });
        break;
      case "sellers":
        data = await SellerVerification.find(status ? { status } : {})
          .populate("seller", "name email phone")
          .sort({ createdAt: -1 });
        break;
      case "sold":
        // Get all sold items across different types
        const [soldProperties, soldMaterials, soldTourism] = await Promise.all([
          Property.find({ status: "sold" }).populate("owner", "name email phone").sort({ createdAt: -1 }),
          Material.find({ status: "sold" }).populate("seller", "name email phone").sort({ createdAt: -1 }),
          TourismListing.find({ status: "sold" }).populate("owner", "name email phone").sort({ createdAt: -1 }),
        ]);
        data = [
          ...soldProperties.map(item => ({ ...item.toObject(), itemType: "property" })),
          ...soldMaterials.map(item => ({ ...item.toObject(), itemType: "material" })),
          ...soldTourism.map(item => ({ ...item.toObject(), itemType: "tourism" })),
        ];
        break;
      default:
        return res.status(400).json({ error: "❌ Invalid type parameter" });
    }

    res.json(data);
  } catch (error) {
    console.error("❌ Get all items error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch items" });
  }
});

// ====================== APPROVE PROPERTY ======================
router.patch("/properties/:id/approve", protect, adminOnly, async (req, res) => {
  try {
    const property = await Property.findByIdAndUpdate(
      req.params.id,
      { status: "approved" },
      { new: true }
    ).populate("owner", "email");

    if (!property) return res.status(404).json({ error: "❌ Property not found" });

    await sendPropertyApprovalEmail(property.owner.email, property.title);
    res.json({ success: true, message: "✅ Property approved", property });
  } catch (error) {
    console.error("❌ Approve property error:", error);
    res.status(500).json({ error: error.message || "Failed to approve property" });
  }
});

// ====================== REJECT PROPERTY ======================
router.patch("/properties/:id/reject", protect, adminOnly, async (req, res) => {
  try {
    const property = await Property.findByIdAndUpdate(
      req.params.id,
      { status: "rejected" },
      { new: true }
    );

    if (!property) return res.status(404).json({ error: "❌ Property not found" });

    res.json({ success: true, message: "✅ Property rejected", property });
  } catch (error) {
    console.error("❌ Reject property error:", error);
    res.status(500).json({ error: error.message || "Failed to reject property" });
  }
});

// ====================== APPROVE MATERIAL ======================
router.patch("/materials/:id/approve", protect, adminOnly, async (req, res) => {
  try {
    const material = await Material.findByIdAndUpdate(
      req.params.id,
      { status: "active", isVerified: true },
      { new: true }
    ).populate("seller", "email");

    if (!material) return res.status(404).json({ error: "❌ Material not found" });

    await sendMaterialApprovalEmail(material.seller.email, material.title);
    res.json({ success: true, message: "✅ Material approved", material });
  } catch (error) {
    console.error("❌ Approve material error:", error);
    res.status(500).json({ error: error.message || "Failed to approve material" });
  }
});

// ====================== REJECT MATERIAL ======================
router.patch("/materials/:id/reject", protect, adminOnly, async (req, res) => {
  try {
    const material = await Material.findByIdAndUpdate(
      req.params.id,
      { status: "rejected" },
      { new: true }
    );

    if (!material) return res.status(404).json({ error: "❌ Material not found" });

    res.json({ success: true, message: "✅ Material rejected", material });
  } catch (error) {
    console.error("❌ Reject material error:", error);
    res.status(500).json({ error: error.message || "Failed to reject material" });
  }
});

// ====================== APPROVE TOURISM ======================
router.patch("/tourism/:id/approve", protect, adminOnly, async (req, res) => {
  try {
    const tourism = await TourismListing.findByIdAndUpdate(
      req.params.id,
      { status: "approved" },
      { new: true }
    ).populate("owner", "email");

    if (!tourism) return res.status(404).json({ error: "❌ Tourism listing not found" });

    await sendTourismApprovalEmail(tourism.owner.email, tourism.name);
    res.json({ success: true, message: "✅ Tourism listing approved", tourism });
  } catch (error) {
    console.error("❌ Approve tourism error:", error);
    res.status(500).json({ error: error.message || "Failed to approve tourism listing" });
  }
});

// ====================== REJECT TOURISM ======================
router.patch("/tourism/:id/reject", protect, adminOnly, async (req, res) => {
  try {
    const tourism = await TourismListing.findByIdAndUpdate(
      req.params.id,
      { status: "rejected" },
      { new: true }
    );

    if (!tourism) return res.status(404).json({ error: "❌ Tourism listing not found" });

    res.json({ success: true, message: "✅ Tourism listing rejected", tourism });
  } catch (error) {
    console.error("❌ Reject tourism error:", error);
    res.status(500).json({ error: error.message || "Failed to reject tourism listing" });
  }
});

// ====================== APPROVE MOVER ======================
router.patch("/movers/:id/approve", protect, adminOnly, async (req, res) => {
  try {
    const mover = await User.findByIdAndUpdate(
      req.params.id,
      { isApproved: true, status: "approved" },
      { new: true }
    );

    if (!mover) return res.status(404).json({ error: "❌ Mover not found" });

    await sendMoverApprovalEmail(mover.email, mover.name);
    res.json({ success: true, message: "✅ Mover approved", mover });
  } catch (error) {
    console.error("❌ Approve mover error:", error);
    res.status(500).json({ error: error.message || "Failed to approve mover" });
  }
});

// ====================== REJECT MOVER ======================
router.patch("/movers/:id/reject", protect, adminOnly, async (req, res) => {
  try {
    const mover = await User.findByIdAndUpdate(
      req.params.id,
      { isApproved: false, status: "rejected" },
      { new: true }
    );

    if (!mover) return res.status(404).json({ error: "❌ Mover not found" });

    res.json({ success: true, message: "✅ Mover rejected", mover });
  } catch (error) {
    console.error("❌ Reject mover error:", error);
    res.status(500).json({ error: error.message || "Failed to reject mover" });
  }
});

// ====================== APPROVE SELLER ======================
router.patch("/sellers/:id/approve", protect, adminOnly, async (req, res) => {
  try {
    const seller = await SellerVerification.findByIdAndUpdate(
      req.params.id,
      { status: "verified", verifiedAt: new Date() },
      { new: true }
    ).populate("seller", "email");

    if (!seller) return res.status(404).json({ error: "❌ Seller verification not found" });

    res.json({ success: true, message: "✅ Seller verified", seller });
  } catch (error) {
    console.error("❌ Approve seller error:", error);
    res.status(500).json({ error: error.message || "Failed to approve seller" });
  }
});

// ====================== REJECT SELLER ======================
router.patch("/sellers/:id/reject", protect, adminOnly, async (req, res) => {
  try {
    const seller = await SellerVerification.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", rejectionReason: req.body.reason || "" },
      { new: true }
    );

    if (!seller) return res.status(404).json({ error: "❌ Seller verification not found" });

    res.json({ success: true, message: "✅ Seller rejected", seller });
  } catch (error) {
    console.error("❌ Reject seller error:", error);
    res.status(500).json({ error: error.message || "Failed to reject seller" });
  }
});

// ====================== GET DASHBOARD STATS ======================
router.get("/stats", protect, adminOnly, async (req, res) => {
  try {
    const [
      totalProperties,
      pendingProperties,
      totalMaterials,
      pendingMaterials,
      totalTourism,
      pendingTourism,
      totalMovers,
      pendingMovers,
      totalSellers,
      pendingSellers,
      totalBusinesses,
      pendingBusinesses,
    ] = await Promise.all([
      Property.countDocuments(),
      Property.countDocuments({ status: "pending" }),
      Material.countDocuments(),
      Material.countDocuments({ status: "pending" }),
      TourismListing.countDocuments(),
      TourismListing.countDocuments({ status: "pending" }),
      User.countDocuments({ role: "mover" }),
      User.countDocuments({ role: "mover", status: "pending" }),
      SellerVerification.countDocuments(),
      SellerVerification.countDocuments({ status: "pending" }),
      Business.countDocuments(),
      Business.countDocuments({ status: "pending" }),
    ]);

    res.json({
      properties: { total: totalProperties, pending: pendingProperties },
      materials: { total: totalMaterials, pending: pendingMaterials },
      tourism: { total: totalTourism, pending: pendingTourism },
      movers: { total: totalMovers, pending: pendingMovers },
      sellers: { total: totalSellers, pending: pendingSellers },
      businesses: { total: totalBusinesses, pending: pendingBusinesses },
    });
  } catch (error) {
    console.error("❌ Get stats error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch stats" });
  }
});

// ====================== DELETE USER ======================
router.delete("/users/:id", protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: "❌ User not found" });

    // Also delete user's properties, materials, and tourism listings
    await Property.deleteMany({ owner: req.params.id });
    await Material.deleteMany({ seller: req.params.id });
    await TourismListing.deleteMany({ owner: req.params.id });

    res.json({ success: true, message: "✅ User deleted successfully" });
  } catch (error) {
    console.error("❌ Delete user error:", error);
    res.status(500).json({ error: error.message || "Failed to delete user" });
  }
});

// ====================== DELETE PROPERTY ======================
router.delete("/properties/:id", protect, adminOnly, async (req, res) => {
  try {
    const property = await Property.findByIdAndDelete(req.params.id);
    if (!property) return res.status(404).json({ error: "❌ Property not found" });

    res.json({ success: true, message: "✅ Property deleted successfully" });
  } catch (error) {
    console.error("❌ Delete property error:", error);
    res.status(500).json({ error: error.message || "Failed to delete property" });
  }
});

// ====================== DELETE MATERIAL ======================
router.delete("/materials/:id", protect, adminOnly, async (req, res) => {
  try {
    console.log("Attempting to delete material with ID:", req.params.id);
    const material = await Material.findByIdAndDelete(req.params.id);
    if (!material) {
      console.log("Material not found with ID:", req.params.id);
      return res.status(404).json({ error: "❌ Material not found" });
    }
    console.log("Material deleted successfully:", material._id);
    res.json({ success: true, message: "✅ Material deleted successfully" });
  } catch (error) {
    console.error("❌ Delete material error:", error);
    res.status(500).json({ error: error.message || "Failed to delete material" });
  }
});

// ====================== DELETE TOURISM ======================
router.delete("/tourism/:id", protect, adminOnly, async (req, res) => {
  try {
    const tourism = await TourismListing.findByIdAndDelete(req.params.id);
    if (!tourism) return res.status(404).json({ error: "❌ Tourism listing not found" });

    res.json({ success: true, message: "✅ Tourism listing deleted successfully" });
  } catch (error) {
    console.error("❌ Delete tourism error:", error);
    res.status(500).json({ error: error.message || "Failed to delete tourism listing" });
  }
});

// ====================== DELETE MOVER ======================
router.delete("/movers/:id", protect, adminOnly, async (req, res) => {
  try {
    const mover = await User.findByIdAndDelete(req.params.id);
    if (!mover) return res.status(404).json({ error: "❌ Mover not found" });

    res.json({ success: true, message: "✅ Mover deleted successfully" });
  } catch (error) {
    console.error("❌ Delete mover error:", error);
    res.status(500).json({ error: error.message || "Failed to delete mover" });
  }
});

// ====================== VIEW STATISTICS ======================
router.get("/view-stats", protect, adminOnly, async (req, res) => {
  try {
    const { type, category, startDate, endDate } = req.query;

    let data = {};
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    switch (type) {
      case "properties":
        const propertyFilter = { ...dateFilter };
        if (category) propertyFilter.propertyType = category;
        data = await Property.aggregate([
          { $match: propertyFilter },
          {
            $group: {
              _id: "$propertyType",
              totalViews: { $sum: "$views" },
              totalItems: { $sum: 1 },
              avgViews: { $avg: "$views" }
            }
          },
          { $sort: { totalViews: -1 } }
        ]);
        break;

      case "materials":
        const materialFilter = { ...dateFilter };
        if (category) materialFilter.category = category;
        data = await Material.aggregate([
          { $match: materialFilter },
          {
            $group: {
              _id: "$category",
              totalViews: { $sum: "$views" },
              totalItems: { $sum: 1 },
              avgViews: { $avg: "$views" }
            }
          },
          { $sort: { totalViews: -1 } }
        ]);
        break;

      case "tourism":
        const tourismFilter = { ...dateFilter };
        if (category) tourismFilter.category = category;
        data = await TourismListing.aggregate([
          { $match: tourismFilter },
          {
            $group: {
              _id: "$category",
              totalViews: { $sum: "$views" },
              totalItems: { $sum: 1 },
              avgViews: { $avg: "$views" }
            }
          },
          { $sort: { totalViews: -1 } }
        ]);
        break;

      default:
        // Get all stats
        const propertyStats = await Property.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: "$propertyType",
              totalViews: { $sum: "$views" },
              totalItems: { $sum: 1 }
            }
          }
        ]);

        const materialStats = await Material.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: "$category",
              totalViews: { $sum: "$views" },
              totalItems: { $sum: 1 }
            }
          }
        ]);

        const tourismStats = await TourismListing.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: "$category",
              totalViews: { $sum: "$views" },
              totalItems: { $sum: 1 }
            }
          }
        ]);

        data = {
          properties: propertyStats,
          materials: materialStats,
          tourism: tourismStats
        };
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Get view stats error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch view statistics" });
  }
});

// ====================== TOP VIEWED ITEMS ======================
router.get("/top-viewed", protect, adminOnly, async (req, res) => {
  try {
    const { type, limit = 10 } = req.query;
    const limitNum = parseInt(limit);

    let data = {};

    switch (type) {
      case "properties":
        data = await Property.find()
          .sort({ views: -1 })
          .limit(limitNum)
          .populate("owner", "name email")
          .select("title location propertyType views owner createdAt");
        break;

      case "materials":
        data = await Material.find()
          .sort({ views: -1 })
          .limit(limitNum)
          .populate("seller", "name email")
          .select("title category condition views seller createdAt");
        break;

      case "tourism":
        data = await TourismListing.find()
          .sort({ views: -1 })
          .limit(limitNum)
          .populate("owner", "name email")
          .select("title category location views owner createdAt");
        break;

      default:
        data = {
          properties: await Property.find()
            .sort({ views: -1 })
            .limit(limitNum)
            .select("title location propertyType views createdAt"),
          materials: await Material.find()
            .sort({ views: -1 })
            .limit(limitNum)
            .select("title category condition views createdAt"),
          tourism: await TourismListing.find()
            .sort({ views: -1 })
            .limit(limitNum)
            .select("title category location views createdAt")
        };
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Get top viewed error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch top viewed items" });
  }
});

// ====================== GET ALL NOTIFICATIONS (Unified) ======================
router.get("/notifications", protect, adminOnly, async (req, res) => {
  try {
    // Fetch payment notifications
    const paymentNotifications = await Notification.find({ read: false })
      .sort({ createdAt: -1 })
      .limit(50);

    // Fetch pending approval items
    const [
      pendingProperties,
      pendingMaterials,
      pendingTourism,
      pendingMovers,
      pendingSellers,
      pendingBusinesses,
    ] = await Promise.all([
      Property.find({ status: "pending" })
        .populate("owner", "name email phone")
        .sort({ createdAt: -1 })
        .limit(20),
      Material.find({ status: "pending" })
        .populate("seller", "name email phone")
        .sort({ createdAt: -1 })
        .limit(20),
      TourismListing.find({ status: "pending" })
        .populate("owner", "name email phone")
        .sort({ createdAt: -1 })
        .limit(20),
      User.find({ role: "mover", status: "pending" })
        .sort({ createdAt: -1 })
        .limit(20),
      SellerVerification.find({ status: "pending" })
        .populate("seller", "name email phone")
        .sort({ createdAt: -1 })
        .limit(20),
      Business.find({ status: "pending" })
        .populate("owner", "name email phone")
        .sort({ createdAt: -1 })
        .limit(20),
    ]);

    // Fetch pending announcements from businesses
    const businessesWithPendingAnnouncements = await Business.find({
      "announcements.status": "pending"
    }).populate("owner", "name email phone");

    const pendingAnnouncements = [];
    businessesWithPendingAnnouncements.forEach(business => {
      business.announcements.forEach(announcement => {
        if (announcement.status === "pending") {
          pendingAnnouncements.push({
            ...announcement.toObject(),
            businessId: business._id,
            businessName: business.name,
            owner: business.owner,
          });
        }
      });
    });

    // Transform pending items into notification format
    const transformToNotification = (item, type) => ({
      _id: item._id,
      type,
      title: item.title || item.name || item.businessName || "—",
      category: item.category || item.county || item.vehicleType || "—",
      owner: item.owner || item.seller,
      ownerName: item.owner?.name || item.seller?.name || item.name || "—",
      ownerPhone: item.owner?.phone || item.seller?.phone || item.phone || "—",
      ownerEmail: item.owner?.email || item.seller?.email || item.email || "—",
      status: "pending",
      createdAt: item.createdAt,
      isPayment: false,
    });

    const allNotifications = [
      ...paymentNotifications.map(n => ({ ...n.toObject(), isPayment: true })),
      ...pendingProperties.map(p => transformToNotification(p, "property")),
      ...pendingMaterials.map(m => transformToNotification(m, "material")),
      ...pendingTourism.map(t => transformToNotification(t, "tourism")),
      ...pendingMovers.map(m => transformToNotification(m, "mover")),
      ...pendingSellers.map(s => transformToNotification(s, "seller")),
      ...pendingBusinesses.map(b => transformToNotification(b, "business")),
      ...pendingAnnouncements.map(a => ({
        ...a,
        type: "announcement",
        title: a.title,
        businessName: a.businessName,
        owner: a.owner,
        ownerName: a.owner?.name || a.submitterName || "—",
        ownerPhone: a.owner?.phone || "—",
        ownerEmail: a.owner?.email || "—",
        status: "pending",
        isPayment: false,
      })),
    ];

    // Sort by createdAt descending
    allNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      notifications: allNotifications,
      summary: {
        total: allNotifications.length,
        payments: paymentNotifications.length,
        properties: pendingProperties.length,
        materials: pendingMaterials.length,
        tourism: pendingTourism.length,
        movers: pendingMovers.length,
        sellers: pendingSellers.length,
        businesses: pendingBusinesses.length,
        announcements: pendingAnnouncements.length,
      },
    });
  } catch (error) {
    console.error("❌ Get notifications error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch notifications" });
  }
});

export default router;
