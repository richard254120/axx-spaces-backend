import mongoose from "mongoose";

const propertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please provide title"],
    },
    description: {
      type: String,
      required: [true, "Please provide description"],
    },
    location: {
      type: String,
      required: [true, "Please provide location"],
    },
    price: {
      type: Number,
      required: [true, "Please provide price"],
    },

    deposit: { type: Number, default: 0 },
    furnished: { type: Boolean, default: false },
    leaseType: {
      type: String,
      enum: ["monthly", "6months", "yearly"],
      default: "monthly",
    },
    availableFrom: { type: Date },
    rules: { type: String, default: "" },

    propertyType: {
      type: String,
      required: true,
    },
    county: {
      type: String,
      required: true,
    },
    lat: {
      type: Number,
    },
    lng: {
      type: Number,
    },

    bedrooms: { type: Number, required: true },
    bathrooms: { type: Number, required: true },
    amenities: [String],
    images: [String],

    // BOOKING SYSTEM
    totalUnits: { type: Number, required: true, default: 1, min: 1 },
    bookedUnits: { type: Number, default: 0, min: 0 },
    availableUnits: { type: Number, default: 0 },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    // ✅ NEW FIELDS FOR MONETIZATION 
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    promotionEndDate: {
      type: Date,
      default: null,
    },
    promotionTier: {
      type: String,
      enum: ["none", "boost-7days", "boost-30days", "premium-30days"],
      default: "none",
    },
    promotionStartDate: {
      type: Date,
      default: null,
    },
    views: {
      type: Number,
      default: 0,
    },
    inquiries: {
      type: Number,
      default: 0,
    },

    // ✅ REVIEWS - Added (No other changes made)
    reviews: [{
      name: { type: String, required: true },
      rating: { type: Number, required: true, min: 1, max: 5 },
      comment: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
    }]
  },
  { timestamps: true }
);

// ✅ Keep availableUnits accurate & auto-unfeature expired promotions
propertySchema.pre("save", function (next) {
  this.availableUnits = Math.max(0, this.totalUnits - this.bookedUnits);
  
  // Auto-unfeature if promotion expired
  if (this.isFeatured && this.promotionEndDate && new Date() > this.promotionEndDate) {
    this.isFeatured = false;
    this.promotionTier = "none";
  }
  
  next();
});

const Property =
  mongoose.models.Property || mongoose.model("Property", propertySchema);

export default Property;