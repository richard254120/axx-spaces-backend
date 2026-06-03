import express from "express";
import { auth } from "../middleware/auth.js";
import BusinessReview from "../models/BusinessReview.js";
import Business from "../models/Business.js";

const router = express.Router();

// ====================== GET REVIEWS FOR A BUSINESS ======================
router.get("/business/:businessId", async (req, res) => {
  try {
    const { businessId } = req.params;
    const { page = 1, limit = 10, sort = "newest" } = req.query;

    const filter = { business: businessId, status: "approved" };

    let sortOption = {};
    switch (sort) {
      case "newest":
        sortOption = { createdAt: -1 };
        break;
      case "oldest":
        sortOption = { createdAt: 1 };
        break;
      case "highest":
        sortOption = { rating: -1 };
        break;
      case "lowest":
        sortOption = { rating: 1 };
        break;
      case "helpful":
        sortOption = { helpful: -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    const reviews = await BusinessReview.find(filter)
      .populate("user", "name email")
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await BusinessReview.countDocuments(filter);

    res.json({
      success: true,
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get business reviews error:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// ====================== GET USER'S REVIEWS ======================
router.get("/my", auth, async (req, res) => {
  try {
    const reviews = await BusinessReview.find({ user: req.user.id })
      .populate("business", "name")
      .sort({ createdAt: -1 });

    res.json({ success: true, reviews });
  } catch (error) {
    console.error("Get user reviews error:", error);
    res.status(500).json({ error: "Failed to fetch your reviews" });
  }
});

// ====================== CREATE REVIEW ======================
router.post("/business/:businessId", async (req, res) => {
  try {
    const { businessId } = req.params;
    const { rating, title, comment, pros, cons, images, userName } = req.body;

    // Check if business exists
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    const review = new BusinessReview({
      business: businessId,
      user: null, // Allow anonymous reviews
      userName: userName || "Anonymous",
      rating,
      title,
      comment,
      pros: pros || [],
      cons: cons || [],
      images: images || [],
      status: "approved", // Auto-approve for now, can be changed to pending
    });

    await review.save();

    // Update business rating statistics
    const allReviews = await BusinessReview.find({ business: businessId, status: "approved" });
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    business.rating = Math.round(avgRating * 10) / 10;
    business.reviewCount = allReviews.length;
    await business.save();

    res.json({ success: true, message: "Review submitted successfully", review });
  } catch (error) {
    console.error("Create review error:", error);
    res.status(500).json({ error: "Failed to submit review" });
  }
});

// ====================== UPDATE REVIEW ======================
router.put("/:reviewId", auth, async (req, res) => {
  try {
    const review = await BusinessReview.findById(req.params.reviewId);

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (review.user.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to update this review" });
    }

    const { rating, title, comment, pros, cons, images } = req.body;

    review.rating = rating || review.rating;
    review.title = title || review.title;
    review.comment = comment || review.comment;
    review.pros = pros || review.pros;
    review.cons = cons || review.cons;
    review.images = images || review.images;
    review.updatedAt = Date.now();

    await review.save();

    // Recalculate business rating
    const business = await Business.findById(review.business);
    const allReviews = await BusinessReview.find({ business: review.business, status: "approved" });
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    business.rating = Math.round(avgRating * 10) / 10;
    await business.save();

    res.json({ success: true, message: "Review updated successfully", review });
  } catch (error) {
    console.error("Update review error:", error);
    res.status(500).json({ error: "Failed to update review" });
  }
});

// ====================== DELETE REVIEW ======================
router.delete("/:reviewId", auth, async (req, res) => {
  try {
    const review = await BusinessReview.findById(req.params.reviewId);

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (review.user.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to delete this review" });
    }

    await BusinessReview.findByIdAndDelete(req.params.reviewId);

    // Recalculate business rating
    const business = await Business.findById(review.business);
    const allReviews = await BusinessReview.find({ business: review.business, status: "approved" });
    const avgRating = allReviews.length > 0
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
      : 0;
    business.rating = Math.round(avgRating * 10) / 10;
    business.reviewCount = allReviews.length;
    await business.save();

    res.json({ success: true, message: "Review deleted successfully" });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({ error: "Failed to delete review" });
  }
});

// ====================== MARK REVIEW AS HELPFUL ======================
router.post("/:reviewId/helpful", async (req, res) => {
  try {
    const review = await BusinessReview.findById(req.params.reviewId);

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    review.helpful += 1;
    await review.save();

    res.json({ success: true, message: "Review marked as helpful", helpful: review.helpful });
  } catch (error) {
    console.error("Mark helpful error:", error);
    res.status(500).json({ error: "Failed to mark review as helpful" });
  }
});

// ====================== REPORT REVIEW ======================
router.post("/:reviewId/report", auth, async (req, res) => {
  try {
    const review = await BusinessReview.findById(req.params.reviewId);

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    review.reported = true;
    review.status = "pending";
    await review.save();

    res.json({ success: true, message: "Review reported for review" });
  } catch (error) {
    console.error("Report review error:", error);
    res.status(500).json({ error: "Failed to report review" });
  }
});

// ====================== ADMIN: GET PENDING REVIEWS ======================
router.get("/admin/pending", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can view pending reviews" });
    }

    const reviews = await BusinessReview.find({ status: "pending" })
      .populate("business", "name")
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.json({ success: true, reviews });
  } catch (error) {
    console.error("Get pending reviews error:", error);
    res.status(500).json({ error: "Failed to fetch pending reviews" });
  }
});

// ====================== ADMIN: APPROVE/REJECT REVIEW ======================
router.patch("/admin/:reviewId/status", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can moderate reviews" });
    }

    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const review = await BusinessReview.findById(req.params.reviewId);

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    review.status = status;
    await review.save();

    // Recalculate business rating if approved
    if (status === "approved") {
      const business = await Business.findById(review.business);
      const allReviews = await BusinessReview.find({ business: review.business, status: "approved" });
      const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
      business.rating = Math.round(avgRating * 10) / 10;
      business.reviewCount = allReviews.length;
      await business.save();
    }

    res.json({ success: true, message: `Review ${status} successfully`, review });
  } catch (error) {
    console.error("Moderate review error:", error);
    res.status(500).json({ error: "Failed to moderate review" });
  }
});

export default router;
