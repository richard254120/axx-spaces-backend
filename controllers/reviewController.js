import Review from "../models/Review.js";
import User from "../models/User.js";

// ====================== CREATE REVIEW ======================
export const createReview = async (req, res) => {
  try {
    const { rating, title, comment, category, relatedId, userName } = req.body;

    if (!rating || !title || !comment) {
      return res.status(400).json({ error: "Rating, title, and comment are required" });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    // Handle both authenticated and anonymous reviews
    let reviewUserName = userName || "Anonymous";
    let userId = null;

    if (req.userId) {
      const user = await User.findById(req.userId);
      if (user) {
        userId = req.userId;
        reviewUserName = user.name;
      }
    }

    const review = new Review({
      user: userId,
      userName: reviewUserName,
      rating,
      title,
      comment,
      category: category || "general",
      relatedId: relatedId || null,
      categoryModel: getCategoryModel(category),
    });

    await review.save();

    res.status(201).json({
      success: true,
      review,
      message: "Review submitted successfully",
    });
  } catch (error) {
    console.error("❌ Create review error:", error);
    res.status(500).json({ error: error.message || "Failed to create review" });
  }
};

// ====================== GET ALL REVIEWS ======================
export const getAllReviews = async (req, res) => {
  try {
    const { category, relatedId, limit = 20, page = 1, sort = "-createdAt" } = req.query;

    const query = { isApproved: true };

    if (category) {
      query.category = category;
    }

    if (relatedId) {
      query.relatedId = relatedId;
    }

    const reviews = await Review.find(query)
      .populate("user", "name email")
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Review.countDocuments(query);

    res.json({
      success: true,
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("❌ Get reviews error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch reviews" });
  }
};

// ====================== GET SINGLE REVIEW ======================
export const getReviewById = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id).populate("user", "name email");

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    res.json({ success: true, review });
  } catch (error) {
    console.error("❌ Get review error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch review" });
  }
};

// ====================== UPDATE REVIEW ======================
export const updateReview = async (req, res) => {
  try {
    const { rating, title, comment } = req.body;

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    // Check if user owns the review or is admin
    if (review.user.toString() !== req.userId && req.userRole !== "admin") {
      return res.status(403).json({ error: "Not authorized to update this review" });
    }

    if (rating) review.rating = rating;
    if (title) review.title = title;
    if (comment) review.comment = comment;

    await review.save();

    res.json({
      success: true,
      review,
      message: "Review updated successfully",
    });
  } catch (error) {
    console.error("❌ Update review error:", error);
    res.status(500).json({ error: error.message || "Failed to update review" });
  }
};

// ====================== DELETE REVIEW ======================
export const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    // Check if user owns the review or is admin
    if (review.user.toString() !== req.userId && req.userRole !== "admin") {
      return res.status(403).json({ error: "Not authorized to delete this review" });
    }

    await Review.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("❌ Delete review error:", error);
    res.status(500).json({ error: error.message || "Failed to delete review" });
  }
};

// ====================== MARK REVIEW AS HELPFUL ======================
export const markHelpful = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    // Check if user already marked as helpful
    if (review.helpfulBy.includes(req.userId)) {
      // Remove helpful mark
      review.helpfulBy = review.helpfulBy.filter(id => id.toString() !== req.userId);
      review.helpfulCount = Math.max(0, review.helpfulCount - 1);
    } else {
      // Add helpful mark
      review.helpfulBy.push(req.userId);
      review.helpfulCount += 1;
    }

    await review.save();

    res.json({
      success: true,
      helpfulCount: review.helpfulCount,
      isHelpful: review.helpfulBy.includes(req.userId),
    });
  } catch (error) {
    console.error("❌ Mark helpful error:", error);
    res.status(500).json({ error: error.message || "Failed to mark review as helpful" });
  }
};

// ====================== ADD REPLY TO REVIEW ======================
export const addReply = async (req, res) => {
  try {
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({ error: "Reply comment is required" });
    }

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    review.replies.push({
      user: req.userId,
      userName: user.name,
      comment,
      createdAt: new Date(),
    });

    await review.save();

    res.json({
      success: true,
      review,
      message: "Reply added successfully",
    });
  } catch (error) {
    console.error("❌ Add reply error:", error);
    res.status(500).json({ error: error.message || "Failed to add reply" });
  }
};

// ====================== GET USER REVIEWS ======================
export const getUserReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ user: req.userId })
      .populate("user", "name email")
      .sort("-createdAt");

    res.json({ success: true, reviews });
  } catch (error) {
    console.error("❌ Get user reviews error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch user reviews" });
  }
};

// ====================== APPROVE/UNAPPROVE REVIEW (ADMIN) ======================
export const approveReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    review.isApproved = !review.isApproved;
    await review.save();

    res.json({
      success: true,
      review,
      message: `Review ${review.isApproved ? 'approved' : 'unapproved'} successfully`,
    });
  } catch (error) {
    console.error("❌ Approve review error:", error);
    res.status(500).json({ error: error.message || "Failed to approve review" });
  }
};

// ====================== GET REVIEWS STATS ======================
export const getReviewsStats = async (req, res) => {
  try {
    const { category, relatedId } = req.query;

    const query = { isApproved: true };

    if (category) {
      query.category = category;
    }

    if (relatedId) {
      query.relatedId = relatedId;
    }

    const stats = await Review.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: "$rating" },
          ratingDistribution: {
            $push: "$rating",
          },
        },
      },
    ]);

    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    if (stats.length > 0) {
      stats[0].ratingDistribution.forEach(rating => {
        ratingCounts[rating]++;
      });
    }

    res.json({
      success: true,
      stats: stats[0] || {
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: [],
      },
      ratingCounts,
    });
  } catch (error) {
    console.error("❌ Get reviews stats error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch review stats" });
  }
};

// Helper function to get category model
function getCategoryModel(category) {
  const models = {
    general: null,
    property: "Property",
    mover: "User",
    merchant: "Material",
    tourism: "Tourism",
  };
  return models[category] || null;
}

export default {
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
};
