import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
  },
  category: {
    type: String,
    enum: ["general", "property", "mover", "merchant", "tourism"],
    default: "general",
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "categoryModel",
  },
  categoryModel: {
    type: String,
    enum: ["Property", "User", "Material", "Tourism"],
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  isApproved: {
    type: Boolean,
    default: true,
  },
  helpfulCount: {
    type: Number,
    default: 0,
  },
  helpfulBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],
  replies: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
}, {
  timestamps: true,
});

// Index for faster queries
reviewSchema.index({ category: 1, relatedId: 1 });
reviewSchema.index({ user: 1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ isApproved: 1 });

// Virtual for average rating
reviewSchema.virtual('averageRating').get(function() {
  return this.rating;
});

// Method to check if user has marked review as helpful
reviewSchema.methods.isHelpfulByUser = function(userId) {
  return this.helpfulBy.includes(userId);
};

const Review = mongoose.model("Review", reviewSchema);

export default Review;
