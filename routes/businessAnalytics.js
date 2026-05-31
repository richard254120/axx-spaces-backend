import express from "express";
import { auth } from "../middleware/auth.js";
import Business from "../models/Business.js";
import BusinessInquiry from "../models/BusinessInquiry.js";
import Favorite from "../models/Favorite.js";

const router = express.Router();

// ====================== GET BUSINESS ANALYTICS ======================
router.get("/:businessId", auth, async (req, res) => {
  try {
    const { businessId } = req.params;
    const { period = "30" } = req.query; // days

    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    // Check if user owns the business
    if (business.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to view analytics" });
    }

    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get daily views for the period
    const dailyViews = business.analytics.dailyViews.filter(
      (dv) => new Date(dv.date) >= startDate
    );

    // Get inquiry count for the period
    const inquiryCount = await BusinessInquiry.countDocuments({
      business: businessId,
      createdAt: { $gte: startDate },
    });

    // Get new favorites for the period
    const favoriteCount = await Favorite.countDocuments({
      business: businessId,
      createdAt: { $gte: startDate },
    });

    res.json({
      success: true,
      analytics: {
        totalViews: business.analytics.profileViews,
        contactClicks: business.analytics.contactClicks,
        websiteClicks: business.analytics.websiteClicks,
        mapClicks: business.analytics.mapClicks,
        totalFavorites: business.analytics.favorites,
        totalInquiries: business.analytics.inquiries,
        periodInquiries: inquiryCount,
        periodFavorites: favoriteCount,
        dailyViews: dailyViews,
        rating: business.rating,
        reviewCount: business.reviewCount,
      },
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// ====================== TRACK PROFILE VIEW ======================
router.post("/:businessId/view", async (req, res) => {
  try {
    const business = await Business.findById(req.params.businessId);
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    business.views += 1;
    business.analytics.profileViews += 1;

    // Update daily views
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const existingDailyView = business.analytics.dailyViews.find(
      (dv) => new Date(dv.date).toDateString() === today.toDateString()
    );

    if (existingDailyView) {
      existingDailyView.count += 1;
    } else {
      business.analytics.dailyViews.push({ date: today, count: 1 });
    }

    // Keep only last 90 days of daily views
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    business.analytics.dailyViews = business.analytics.dailyViews.filter(
      (dv) => new Date(dv.date) >= ninetyDaysAgo
    );

    await business.save();

    res.json({ success: true });
  } catch (error) {
    console.error("Track view error:", error);
    res.status(500).json({ error: "Failed to track view" });
  }
});

// ====================== TRACK CONTACT CLICK ======================
router.post("/:businessId/contact-click", async (req, res) => {
  try {
    const business = await Business.findById(req.params.businessId);
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    business.analytics.contactClicks += 1;
    await business.save();

    res.json({ success: true });
  } catch (error) {
    console.error("Track contact click error:", error);
    res.status(500).json({ error: "Failed to track contact click" });
  }
});

// ====================== TRACK WEBSITE CLICK ======================
router.post("/:businessId/website-click", async (req, res) => {
  try {
    const business = await Business.findById(req.params.businessId);
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    business.analytics.websiteClicks += 1;
    await business.save();

    res.json({ success: true });
  } catch (error) {
    console.error("Track website click error:", error);
    res.status(500).json({ error: "Failed to track website click" });
  }
});

// ====================== TRACK MAP CLICK ======================
router.post("/:businessId/map-click", async (req, res) => {
  try {
    const business = await Business.findById(req.params.businessId);
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    business.analytics.mapClicks += 1;
    await business.save();

    res.json({ success: true });
  } catch (error) {
    console.error("Track map click error:", error);
    res.status(500).json({ error: "Failed to track map click" });
  }
});

export default router;
