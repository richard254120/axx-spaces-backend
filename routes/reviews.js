import express from "express";
import {
  createReview,
  getAllReviews,
  getReviewById,
  updateReview,
  deleteReview,
  markHelpful,
  addReply,
  getUserReviews,
  approveReview,
  getReviewsStats,
} from "../controllers/reviewController.js";
import { protect, authorize } from "../middleware/enhancedAuth.js";

const router = express.Router();

// ====================== PUBLIC ROUTES ======================
// Get all reviews (public)
router.get("/", getAllReviews);

// Get single review (public)
router.get("/:id", getReviewById);

// Get reviews stats (public)
router.get("/stats/summary", getReviewsStats);

// Create review (public - allows anonymous reviews)
router.post("/", createReview);

// Get user's own reviews (requires authentication)
router.get("/user/my-reviews", protect, getUserReviews);

// Update review (requires authentication and ownership)
router.put("/:id", protect, updateReview);

// Delete review (requires authentication and ownership)
router.delete("/:id", protect, deleteReview);

// Mark review as helpful (requires authentication)
router.post("/:id/helpful", protect, markHelpful);

// Add reply to review (requires authentication)
router.post("/:id/reply", protect, addReply);

// ====================== ADMIN ROUTES ======================
// Approve/unapprove review (admin only)
router.patch("/:id/approve", protect, authorize("admin"), approveReview);

export default router;
