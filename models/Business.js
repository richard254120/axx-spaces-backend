import mongoose from "mongoose";

const businessSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  submitterName: {
    type: String,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  yearEstablished: {
    type: Number,
    min: 1900,
    max: new Date().getFullYear(),
  },
  employeeCount: {
    type: String,
    enum: ["1-10", "11-50", "51-200", "201-500", "500+"],
  },
  priceRange: {
    type: String,
    enum: ["$", "$$", "$$$", "$$$$"],
  },
  categories: [{
    type: String,
    required: true,
  }],
  location: {
    county: {
      type: String,
      required: true,
    },
    town: {
      type: String,
      required: true,
    },
    address: String,
    coordinates: {
      lat: Number,
      lng: Number,
    },
  },
  contact: {
    phone: {
      type: String,
      required: true,
    },
    email: String,
    website: String,
  },
  businessHours: {
    monday: { open: String, close: String, closed: { type: Boolean, default: false } },
    tuesday: { open: String, close: String, closed: { type: Boolean, default: false } },
    wednesday: { open: String, close: String, closed: { type: Boolean, default: false } },
    thursday: { open: String, close: String, closed: { type: Boolean, default: false } },
    friday: { open: String, close: String, closed: { type: Boolean, default: false } },
    saturday: { open: String, close: String, closed: { type: Boolean, default: false } },
    sunday: { open: String, close: String, closed: { type: Boolean, default: false } },
  },
  socialMedia: {
    facebook: String,
    instagram: String,
    twitter: String,
    linkedin: String,
    tiktok: String,
    whatsapp: String,
  },
  images: [{
    type: String,
  }],
  verificationBadges: [{
    type: {
      type: String,
      enum: ["student_verified", "identity_verified", "business_verified", "online_verified", "location_verified", "premium_verified"],
    },
    verifiedAt: {
      type: Date,
      default: Date.now,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  }],
  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "suspended"],
    default: "pending",
  },
  isApproved: {
    type: Boolean,
    default: false,
  },
  isFirstUpload: {
    type: Boolean,
    default: true,
  },
  offers: [{
    title: String,
    description: String,
    discount: Number,
    validUntil: Date,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  announcements: [{
    title: String,
    content: String,
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  featured: {
    type: Boolean,
    default: false,
  },
  featuredUntil: Date,
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

businessSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Business = mongoose.models.Business || mongoose.model("Business", businessSchema);

export default Business;
