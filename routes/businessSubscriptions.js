import express from "express";
import { auth } from "../middleware/auth.js";
import BusinessSubscription from "../models/BusinessSubscription.js";
import Business from "../models/Business.js";

const router = express.Router();

const TIER_PRICES = {
  basic: { monthly: 0, yearly: 0, features: ["basic_listing"] },
  bronze: { monthly: 499, yearly: 4990, features: ["featured_listing", "analytics_dashboard", "verified_badge"] },
  silver: { monthly: 999, yearly: 9990, features: ["featured_listing", "priority_search", "analytics_dashboard", "verified_badge", "unlimited_photos"] },
  gold: { monthly: 1999, yearly: 19990, features: ["featured_listing", "priority_search", "analytics_dashboard", "verified_badge", "unlimited_photos", "video_tour", "promotions", "events"] },
  platinum: { monthly: 4999, yearly: 49990, features: ["featured_listing", "priority_search", "analytics_dashboard", "verified_badge", "unlimited_photos", "video_tour", "promotions", "events", "lead_generation", "custom_branding", "priority_support"] },
};

// ====================== GET SUBSCRIPTION TIERS ======================
router.get("/tiers", (req, res) => {
  res.json({
    success: true,
    tiers: TIER_PRICES,
  });
});

// ====================== GET BUSINESS SUBSCRIPTION ======================
router.get("/business/:businessId", auth, async (req, res) => {
  try {
    const { businessId } = req.params;

    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    if (business.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to view subscription" });
    }

    const subscription = await BusinessSubscription.findOne({ business: businessId }).sort({ createdAt: -1 });

    res.json({ success: true, subscription });
  } catch (error) {
    console.error("Get subscription error:", error);
    res.status(500).json({ error: "Failed to fetch subscription" });
  }
});

// ====================== CREATE SUBSCRIPTION ======================
router.post("/business/:businessId", auth, async (req, res) => {
  try {
    const { businessId } = req.params;
    const { tier, billingCycle, paymentMethod, transactionId } = req.body;

    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    if (business.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to create subscription" });
    }

    const pricing = TIER_PRICES[tier];
    if (!pricing) {
      return res.status(400).json({ error: "Invalid tier" });
    }

    const amount = billingCycle === "yearly" ? pricing.yearly : pricing.monthly;
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + (billingCycle === "yearly" ? 12 : 1));

    const subscription = new BusinessSubscription({
      business: businessId,
      tier,
      status: "active",
      startDate: new Date(),
      endDate,
      paymentMethod,
      transactionId,
      amount,
      features: pricing.features,
    });

    await subscription.save();

    // Update business with premium features
    if (tier !== "basic") {
      business.isApproved = true;
      business.status = "approved";

      // Add verification badge based on tier
      const badgeTypeMap = {
        bronze: "business_verified",
        silver: "premium_verified",
        gold: "premium_verified",
        platinum: "premium_verified"
      };

      const badgeType = badgeTypeMap[tier];
      if (badgeType) {
        // Check if badge already exists
        const existingBadge = business.verificationBadges.find(b => b.type === badgeType);
        if (!existingBadge) {
          business.verificationBadges.push({
            type: badgeType,
            tier: tier,
            verifiedAt: Date.now(),
            verifiedBy: req.user.id,
            documents: []
          });
        }
      }
    }

    await business.save();

    res.json({ success: true, message: "Subscription created successfully", subscription });
  } catch (error) {
    console.error("Create subscription error:", error);
    res.status(500).json({ error: "Failed to create subscription" });
  }
});

// ====================== UPGRADE SUBSCRIPTION ======================
router.put("/:subscriptionId/upgrade", auth, async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { tier, billingCycle } = req.body;

    const subscription = await BusinessSubscription.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    const business = await Business.findById(subscription.business);
    if (business.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to upgrade subscription" });
    }

    const pricing = TIER_PRICES[tier];
    if (!pricing) {
      return res.status(400).json({ error: "Invalid tier" });
    }

    const amount = billingCycle === "yearly" ? pricing.yearly : pricing.monthly;
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + (billingCycle === "yearly" ? 12 : 1));

    subscription.tier = tier;
    subscription.endDate = endDate;
    subscription.amount = amount;
    subscription.features = pricing.features;
    subscription.updatedAt = Date.now();

    await subscription.save();

    res.json({ success: true, message: "Subscription upgraded successfully", subscription });
  } catch (error) {
    console.error("Upgrade subscription error:", error);
    res.status(500).json({ error: "Failed to upgrade subscription" });
  }
});

// ====================== CANCEL SUBSCRIPTION ======================
router.put("/:subscriptionId/cancel", auth, async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    const subscription = await BusinessSubscription.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    const business = await Business.findById(subscription.business);
    if (business.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to cancel subscription" });
    }

    subscription.status = "cancelled";
    subscription.autoRenew = false;
    subscription.updatedAt = Date.now();

    await subscription.save();

    res.json({ success: true, message: "Subscription cancelled successfully", subscription });
  } catch (error) {
    console.error("Cancel subscription error:", error);
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

// ====================== CHECK SUBSCRIPTION STATUS ======================
router.get("/check/:businessId", async (req, res) => {
  try {
    const { businessId } = req.params;

    const subscription = await BusinessSubscription.findOne({
      business: businessId,
      status: "active",
      endDate: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!subscription) {
      return res.json({ success: true, isActive: false, tier: "basic" });
    }

    res.json({
      success: true,
      isActive: true,
      tier: subscription.tier,
      features: subscription.features,
      endDate: subscription.endDate,
    });
  } catch (error) {
    console.error("Check subscription error:", error);
    res.status(500).json({ error: "Failed to check subscription" });
  }
});

export default router;
