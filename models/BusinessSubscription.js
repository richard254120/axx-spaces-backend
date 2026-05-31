import mongoose from "mongoose";

const businessSubscriptionSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Business",
    required: true,
  },
  tier: {
    type: String,
    enum: ["basic", "bronze", "silver", "gold", "platinum"],
    default: "basic",
  },
  status: {
    type: String,
    enum: ["active", "expired", "cancelled", "pending"],
    default: "active",
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
  },
  autoRenew: {
    type: Boolean,
    default: false,
  },
  paymentMethod: {
    type: String,
    enum: ["mpesa", "card", "bank"],
  },
  transactionId: String,
  amount: Number,
  features: [{
    type: String,
    enum: [
      "featured_listing",
      "priority_search",
      "analytics_dashboard",
      "verified_badge",
      "unlimited_photos",
      "video_tour",
      "promotions",
      "events",
      "lead_generation",
      "custom_branding",
      "priority_support",
    ],
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

businessSubscriptionSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

businessSubscriptionSchema.index({ business: 1 });
businessSubscriptionSchema.index({ status: 1 });
businessSubscriptionSchema.index({ endDate: 1 });

const BusinessSubscription = mongoose.models.BusinessSubscription || mongoose.model("BusinessSubscription", businessSubscriptionSchema);

export default BusinessSubscription;
