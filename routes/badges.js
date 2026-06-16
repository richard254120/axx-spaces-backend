import express from "express";
import {
  issueBadge,
  removeBadge,
  getListingBadges,
  getAllBadges,
  getBadgeStats,
} from "../controllers/badgeController.js";
import { protect, adminOnly } from "../middleware/auth.js";

const router = express.Router();

// ====================== ISSUE BADGE TO LISTING ======================
router.post("/issue", protect, adminOnly, issueBadge);

// ====================== REMOVE BADGE FROM LISTING ======================
router.post("/remove", protect, adminOnly, removeBadge);

// ====================== GET LISTING BADGES ======================
router.get("/:listingType/:listingId", getListingBadges);

// ====================== GET ALL BADGES (ADMIN) ======================
router.get("/", protect, adminOnly, getAllBadges);

// ====================== GET BADGE STATISTICS (ADMIN) ======================
router.get("/stats/summary", protect, adminOnly, getBadgeStats);

export default router;
