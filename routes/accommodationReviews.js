import express from "express";
import Review from "../models/Review.js";
import Accommodation from "../models/Accommodation.js";
import Booking from "../models/Booking.js";
import { auth } from "../middleware/auth.js";
import security from "../middleware/security.js";

const router = express.Router();

// ====================== GET REVIEWS FOR ACCOMMODATION ======================
router.get("/accommodation/:accommodationId", async (req, res) => {
  try {
    const { accommodationId } = req.params;
    const { limit, skip } = req.query;

    const accommodation = await Accommodation.findById(accommodationId);
    if (!accommodation) {
      return res.status(404).json({ error: "Accommodation not found" });
    }

    const query = {
      category: "accommodation",
      relatedId: accommodationId,
      isApproved: true
    };

    const reviews = await Review.find(query)
      .populate("user", "name profileImage")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) || 50)
      .skip(parseInt(skip) || 0);

    // Calculate average rating
    const allReviews = await Review.find(query);
    const averageRating = allReviews.length > 0
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
      : 0;

    res.json({
      reviews,
      averageRating: parseFloat(averageRating.toFixed(1)),
      totalReviews: allReviews.length,
    });
  } catch (error) {
    console.error("Get accommodation reviews error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch reviews" });
  }
});

// ====================== CREATE REVIEW ======================
router.post("/", auth, security.apiLimiter, async (req, res) => {
  try {
    const { accommodationId, rating, title, comment } = req.body;

    if (!accommodationId || !rating || !title || !comment) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    // Verify accommodation exists
    const accommodation = await Accommodation.findById(accommodationId);
    if (!accommodation) {
      return res.status(404).json({ error: "Accommodation not found" });
    }

    // Verify user has a completed booking for this accommodation
    const completedBooking = await Booking.findOne({
      guest: req.user._id,
      accommodation: accommodationId,
      status: "completed"
    });

    if (!completedBooking) {
      return res.status(403).json({ 
        error: "You can only review accommodations after completing a booking" 
      });
    }

    // Check if user already reviewed this accommodation
    const existingReview = await Review.findOne({
      user: req.user._id,
      category: "accommodation",
      relatedId: accommodationId
    });

    if (existingReview) {
      return res.status(400).json({ error: "You have already reviewed this accommodation" });
    }

    // Create review
    const review = new Review({
      user: req.user._id,
      userName: req.user.name,
      rating: parseInt(rating),
      title: title.trim(),
      comment: comment.trim(),
      category: "accommodation",
      relatedId: accommodationId,
      categoryModel: "Accommodation",
      isVerified: true, // Auto-verify since they completed a booking
    });

    await review.save();

    console.log(`Accommodation review created | ID: ${review._id} | User: ${req.user._id}`);

    res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      review,
    });
  } catch (error) {
    console.error("Create accommodation review error:", error);
    res.status(500).json({ error: error.message || "Failed to create review" });
  }
});

// ====================== UPDATE REVIEW ======================
router.patch("/:id", auth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied. You can only edit your own reviews." });
    }

    const { rating, title, comment } = req.body;

    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }
      review.rating = parseInt(rating);
    }

    if (title !== undefined) review.title = title.trim();
    if (comment !== undefined) review.comment = comment.trim();

    await review.save();

    res.json({
      success: true,
      message: "Review updated successfully",
      review,
    });
  } catch (error) {
    console.error("Update accommodation review error:", error);
    res.status(500).json({ error: error.message || "Failed to update review" });
  }
});

// ====================== DELETE REVIEW ======================
router.delete("/:id", auth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (review.user.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    await Review.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Delete accommodation review error:", error);
    res.status(500).json({ error: error.message || "Failed to delete review" });
  }
});

// ====================== MARK REVIEW AS HELPFUL ======================
router.post("/:id/helpful", auth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (review.helpfulBy.includes(req.user._id)) {
      // Remove helpful mark
      review.helpfulBy = review.helpfulBy.filter(id => id.toString() !== req.user._id.toString());
      review.helpfulCount = Math.max(0, review.helpfulCount - 1);
    } else {
      // Add helpful mark
      review.helpfulBy.push(req.user._id);
      review.helpfulCount += 1;
    }

    await review.save();

    res.json({
      success: true,
      message: "Helpful status updated",
      helpfulCount: review.helpfulCount,
      isHelpful: review.helpfulBy.includes(req.user._id),
    });
  } catch (error) {
    console.error("Mark review helpful error:", error);
    res.status(500).json({ error: error.message || "Failed to update helpful status" });
  }
});

// ====================== ADD REPLY TO REVIEW ======================
router.post("/:id/reply", auth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    const { comment } = req.body;
    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: "Comment is required" });
    }

    // Only accommodation owner or admin can reply
    const accommodation = await Accommodation.findById(review.relatedId);
    const isOwner = accommodation.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Access denied. Only accommodation owners can reply." });
    }

    review.replies.push({
      user: req.user._id,
      userName: req.user.name,
      comment: comment.trim(),
      createdAt: new Date(),
    });

    await review.save();

    res.json({
      success: true,
      message: "Reply added successfully",
      review,
    });
  } catch (error) {
    console.error("Add reply error:", error);
    res.status(500).json({ error: error.message || "Failed to add reply" });
  }
});

export default router;
