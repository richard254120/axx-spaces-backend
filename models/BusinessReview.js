import mongoose from "mongoose";

const businessReviewSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Business",
    required: true,
  },
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
  },
  comment: {
    type: String,
    required: true,
    trim: true,
  },
  pros: [String],
  cons: [String],
  images: [{
    type: String,
  }],
  verified: {
    type: Boolean,
    default: false,
  },
  helpful: {
    type: Number,
    default: 0,
  },
  reported: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

businessReviewSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

businessReviewSchema.index({ business: 1, createdAt: -1 });
businessReviewSchema.index({ user: 1 });
businessReviewSchema.index({ status: 1 });

const BusinessReview = mongoose.models.BusinessReview || mongoose.model("BusinessReview", businessReviewSchema);

export default BusinessReview;
