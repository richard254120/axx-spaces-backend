import express from "express";
import jwt from "jsonwebtoken";
import Property from "../models/Property.js";
import Accommodation from "../models/Accommodation.js";
import ContactReveal from "../models/ContactReveal.js";
import User from "../models/User.js";
import { optionalAuth } from "../middleware/auth.js";
import { PROMOTION_CATALOG } from "../config/promotionCatalog.js";

const router = express.Router();

const DAILY_FREE_LIMIT = Number(process.env.CONTACT_REVEALS_DAILY_LIMIT || 3);
// Provider roles already monetize via subscriptions/promotions — their browsing stays frictionless.
const UNLIMITED_ROLES = ["landlord", "agent", "host", "business", "provider", "caretaker", "admin", "team", "mover", "seller"];

const todayKey = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date());

// Resolve the caller: prefer the optionally-attached user, fall back to decoding the bearer token.
const resolveUser = async (req) => {
  if (req.user) return req.user;
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    return await User.findById(decoded.userId).select("-password");
  } catch {
    return null;
  }
};

const getListing = async (listingType, listingId) => {
  const Model = listingType === "Accommodation" ? Accommodation : Property;
  return Model.findById(listingId)
    .populate("owner", "name phone email verificationBadges")
    .populate("assignedAgent", "name phone email agentProfile");
};

// GET /api/contact-reveal/status?listingType=Property&listingId=...
router.get("/status", optionalAuth, async (req, res) => {
  try {
    const { listingType, listingId } = req.query;
    if (!["Property", "Accommodation"].includes(listingType) || !listingId) {
      return res.status(400).json({ error: "listingType and listingId are required" });
    }

    const user = req.user || null;
    const listing = await getListing(listingType, listingId);
    if (!listing) return res.status(404).json({ error: "Listing not found" });

    const ownerRef = listing.owner?._id || listing.owner;
    const isOwner = user && ownerRef && ownerRef.toString() === user._id.toString();
    const unlimited = !user ? false : UNLIMITED_ROLES.includes(user.role) || isOwner;

    let used = 0;
    if (!unlimited) {
      if (!user) return res.json({ authenticated: false, dailyLimit: DAILY_FREE_LIMIT });
      const record = await ContactReveal.findOne({ user: user._id, day: todayKey() });
      used = record?.count || 0;
    }

    return res.json({
      authenticated: true,
      unlimited,
      used,
      dailyLimit: unlimited ? null : DAILY_FREE_LIMIT,
      remaining: unlimited ? null : Math.max(0, DAILY_FREE_LIMIT - used),
    });
  } catch (error) {
    console.error("Contact reveal status error:", error);
    return res.status(500).json({ error: "Failed to fetch reveal status" });
  }
});

// POST /api/contact-reveal — spend one daily reveal to unlock the listing's contact details
router.post("/", async (req, res) => {
  try {
    const { listingType, listingId } = req.body || {};
    if (!["Property", "Accommodation"].includes(listingType) || !listingId) {
      return res.status(400).json({ error: "listingType and listingId are required" });
    }

    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ error: "Please log in to reveal contact details", code: "LOGIN_REQUIRED" });
    }

    const listing = await getListing(listingType, listingId);
    if (!listing) return res.status(404).json({ error: "Listing not found" });

    const ownerRef = listing.owner?._id || listing.owner;
    const isOwner = ownerRef && ownerRef.toString() === user._id.toString();
    const unlimited = UNLIMITED_ROLES.includes(user.role) || isOwner;

    let usedCount = 0;
    if (!unlimited) {
      const day = todayKey();
      const record = await ContactReveal.findOne({ user: user._id, day });
      usedCount = record?.count || 0;
      if (usedCount >= DAILY_FREE_LIMIT) {
        return res.status(403).json({
          error: `You have used all ${DAILY_FREE_LIMIT} free contact reveals today. Upgrade your plan or come back tomorrow.`,
          code: "LIMIT_REACHED",
          dailyLimit: DAILY_FREE_LIMIT,
        });
      }
      usedCount += 1;
      if (record) {
        record.count = usedCount;
        record.history.push({ listing: listingId, listingModel: listingType });
        await record.save();
      } else {
        await ContactReveal.create({
          user: user._id,
          day,
          count: usedCount,
          history: [{ listing: listingId, listingModel: listingType }],
        });
      }
    }

    const agent = listing.assignedAgent;
    return res.json({
      success: true,
      unlimited,
      dailyLimit: unlimited ? null : DAILY_FREE_LIMIT,
      remaining: unlimited ? null : Math.max(0, DAILY_FREE_LIMIT - usedCount),
      contact: {
        name: listing.owner?.name || listing.managerName || listing.contactName || "Listing owner",
        phone: listing.owner?.phone || listing.phone || null,
        email: listing.owner?.email || null,
        agentName: agent?.name || null,
        agentPhone: agent?.phone || agent?.agentProfile?.phone || null,
      },
      bookingServiceFeePercent: listingType === "Accommodation" ? PROMOTION_CATALOG.bookingServiceFeePercent : 0,
    });
  } catch (error) {
    console.error("Contact reveal error:", error);
    return res.status(500).json({ error: "Failed to reveal contact details" });
  }
});

export default router;
