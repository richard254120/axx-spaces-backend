// routes/boosts.js
const express = require("express");
const router = express.Router();
const Boost = require("../models/Boost");
const Property = require("../models/Property");
const Material = require("../models/Material");
const Tourism = require("../models/Tourism");
const { verifyToken, requireAdmin } = require("../middleware/auth");

// ── helper: resolve listing model ────────────────────────────
const modelFor = (type) => {
    if (type === "Property") return Property;
    if (type === "Material") return Material;
    if (type === "Tourism") return Tourism;
    return null;
};

// ── GET /boosts/pending  (admin only) ─────────────────────────
router.get("/pending", verifyToken, requireAdmin, async (req, res) => {
    try {
        const boosts = await Boost.find({ status: "pending" })
            .populate("user", "name phone email")
            .populate("listing")
            .sort({ createdAt: -1 });
        res.json(boosts);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── GET /boosts/all  (admin only) ─────────────────────────────
router.get("/all", verifyToken, requireAdmin, async (req, res) => {
    try {
        const boosts = await Boost.find()
            .populate("user", "name phone email")
            .populate("listing")
            .sort({ createdAt: -1 })
            .limit(200);
        res.json(boosts);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── POST /boosts  (user submits boost payment) ─────────────────
router.post("/", verifyToken, async (req, res) => {
    try {
        const { listingId, listingModel, listingTitle, listingType, plan, amount, mpesaRef } = req.body;
        if (!listingId || !listingModel || !plan || !amount || !mpesaRef) {
            return res.status(400).json({ error: "Missing required fields." });
        }

        // Validate plan and amount
        const planConfig = {
            "3weeks": { duration: 21, price: 100 },
            "4months": { duration: 120, price: 700 },
            "6months": { duration: 180, price: 1000 },
        };

        const config = planConfig[plan];
        if (!config) {
            return res.status(400).json({ error: "Invalid plan type." });
        }

        if (amount !== config.price) {
            return res.status(400).json({ error: `Invalid amount for ${plan} plan. Expected ${config.price} KES.` });
        }

        const boost = await Boost.create({
            listing: listingId,
            listingModel,
            listingTitle,
            listingType,
            user: req.user._id,
            userName: req.user.name,
            userPhone: req.user.phone,
            plan,
            amount,
            planDuration: config.duration,
            planPrice: config.price,
            mpesaRef,
            status: "pending",
        });

        res.status(201).json(boost);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── PATCH /boosts/:id/approve  (admin) ────────────────────────
// Sets boost → approved, sets listing.isFeatured = true,
// listing.featuredPriority = Date.now() (higher = shown first),
// listing.featuredUntil = now + plan days
// Also issues verification badges based on boost plan
router.patch("/:id/approve", verifyToken, requireAdmin, async (req, res) => {
    try {
        const boost = await Boost.findById(req.params.id);
        if (!boost) return res.status(404).json({ error: "Boost not found." });
        if (boost.status !== "pending") return res.status(400).json({ error: "Boost is not pending." });

        const days = boost.planDuration || 30;
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

        // Update boost record
        boost.status = "approved";
        boost.approvedAt = new Date();
        boost.expiresAt = expiresAt;
        await boost.save();

        // Update the actual listing to mark it featured + set priority
        const ListingModel = modelFor(boost.listingModel);
        if (ListingModel && boost.listing) {
            // Determine badge type based on plan
            let badgeType = null;
            if (boost.plan === "6months") {
                badgeType = "premium_verified";
            } else if (boost.plan === "4months") {
                badgeType = "business_verified";
            } else if (boost.plan === "3weeks") {
                badgeType = "online_verified";
            }

            // Update listing with featured status and badges
            const updateData = {
                isFeatured: true,
                featuredPriority: Date.now(),   // higher number = newer = shown first
                featuredUntil: expiresAt,
            };

            // Add badge if applicable
            if (badgeType) {
                const listing = await ListingModel.findById(boost.listing);
                if (listing) {
                    // Check if badge already exists
                    const existingBadge = listing.verificationBadges?.find(
                        (b) => b.type === badgeType
                    );

                    if (!existingBadge) {
                        // Add new badge
                        const newBadge = {
                            type: badgeType,
                            verifiedAt: new Date(),
                            verifiedBy: req.user._id,
                        };

                        if (!listing.verificationBadges) {
                            listing.verificationBadges = [];
                        }
                        listing.verificationBadges.push(newBadge);
                        await listing.save();
                    }
                }
            }

            await ListingModel.findByIdAndUpdate(boost.listing, updateData);
        }

        res.json({ success: true, boost, expiresAt });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── PATCH /boosts/:id/reject  (admin) ─────────────────────────
router.patch("/:id/reject", verifyToken, requireAdmin, async (req, res) => {
    try {
        const boost = await Boost.findById(req.params.id);
        if (!boost) return res.status(404).json({ error: "Boost not found." });

        boost.status = "rejected";
        boost.rejectedAt = new Date();
        boost.rejectionReason = req.body.reason || "Payment verification failed";
        await boost.save();

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Cron-style expiry check: GET /boosts/expire-check (admin) ─
// Call this from a cron job or scheduled task to auto-expire boosts
router.post("/expire-check", verifyToken, requireAdmin, async (req, res) => {
    try {
        const expired = await Boost.find({
            status: "approved",
            expiresAt: { $lt: new Date() },
        });

        for (const boost of expired) {
            boost.status = "expired";
            await boost.save();
            const ListingModel = modelFor(boost.listingModel);
            if (ListingModel && boost.listing) {
                // Check if another active boost exists for this listing
                const activeBoost = await Boost.findOne({
                    listing: boost.listing,
                    status: "approved",
                    expiresAt: { $gte: new Date() },
                });
                if (!activeBoost) {
                    await ListingModel.findByIdAndUpdate(boost.listing, {
                        isFeatured: false,
                        featuredPriority: 0,
                        featuredUntil: null,
                    });
                }
            }
        }

        res.json({ expired: expired.length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;