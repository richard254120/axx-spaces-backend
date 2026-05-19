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
      enum: ["active", "sold", "archived"],
      default: "active",
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
    inquiries: {
      type: Number,
      default: 0,
    },
    saves: {
      type: Number,
      default: 0,
    },

    // TIMESTAMPS
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for faster queries
materialSchema.index({ category: 1, county: 1, status: 1 });
materialSchema.index({ seller: 1 });
materialSchema.index({ createdAt: -1 });

const Material =
  mongoose.models.Material || mongoose.model("Material", materialSchema);

export default Material;