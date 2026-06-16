import mongoose from "mongoose";

const materialSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please provide material title"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Please provide description"],
    },
    category: {
      type: String,
      required: [true, "Please select category"],
      enum: [
        "Construction Materials",
        "Furniture",
        "Appliances",
        "Electronics",
        "Tools",
        "Other",
      ],
    },
    subcategory: {
      type: String,
      default: "",
    },
    price: {
      type: Number,
      required: [true, "Please provide price"],
      min: 0,
    },
    quantity: {
      type: Number,
      required: [true, "Please provide quantity"],
      min: 1,
    },
    condition: {
      type: String,
      required: [true, "Please select condition"],
      enum: ["Like New", "Good", "Fair", "Poor"],
      default: "Good",
    },
    images: [String], // Cloudinary URLs
    location: {
      type: String,
      required: [true, "Please provide location"],
    },
    county: {
      type: String,
      required: [true, "Please select county"],
    },
    lat: Number,
    lng: Number,

    // SELLER INFO
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sellerName: String,
    sellerPhone: String,
    sellerRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    // STATUS
    status: {
      type: String,
      enum: ["approved", "rejected", "sold", "archived", "pending"],
      default: "pending", // Fixed: Default to pending until approved
    },
    isVerified: {
      type: Boolean,
      default: false,
    },

    // ENGAGEMENT STATS
    views: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    inquiries: {
      type: Number,
      default: 0,
    },
    saves: {
      type: Number,
      default: 0,
    },

    // ✅ MONETIZATION: FEATURED/PROMOTED LISTINGS
    isFeatured: {
      type: Boolean,
      default: false,
    },
    promotionTier: {
      type: String,
      enum: ["boost-7days", "boost-30days"],
    },
    promotionStartDate: {
      type: Date,
    },
    promotionEndDate: {
      type: Date,
    },

    // ✅ VERIFICATION BADGES
    verificationBadges: [{
      type: {
        type: String,
        enum: ["premium_verified", "student_verified", "business_verified", "identity_verified", "location_verified", "online_verified"],
      },
      verifiedAt: {
        type: Date,
        default: Date.now,
      },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    }]
  },
  { timestamps: true }
);

materialSchema.index({ category: 1, county: 1, status: 1 });
materialSchema.index({ seller: 1 });
materialSchema.index({ createdAt: -1 });

const Material = mongoose.models.Material || mongoose.model("Material", materialSchema, "merchants");
export default Material;