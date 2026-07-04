import express from "express";
import {
  issueUserBadge,
  removeUserBadge,
  getUserBadges,
  getAllUserBadges,
  getUserBadgeStats,
  searchUsers,
} from "../controllers/userBadgeController.js";
import { protect, adminOnly } from "../middleware/auth.js";

const router = express.Router();

// ====================== ISSUE BADGE TO USER ======================
router.post("/issue", protect, adminOnly, issueUserBadge);

// ====================== REMOVE BADGE FROM USER ======================
router.post("/remove", protect, adminOnly, removeUserBadge);

// ====================== GET USER BADGES ======================
router.get("/user/:userId", getUserBadges);

// ====================== GET ALL USERS WITH BADGES (ADMIN) ======================
router.get("/", protect, adminOnly, getAllUserBadges);

// ====================== GET USER BADGE STATISTICS (ADMIN) ======================
router.get("/stats/summary", protect, adminOnly, getUserBadgeStats);

// ====================== SEARCH USERS FOR BADGE ISSUANCE ======================
router.get("/search", protect, adminOnly, searchUsers);

export default router;
