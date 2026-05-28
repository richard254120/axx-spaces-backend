import mongoose from "mongoose";

const roomTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    guests: { type: Number, default: 2 },
    desc: { type: String, default: "" },
  },
  { _id: false }
);

const reviewSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    date: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const tourismListingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    description: { type: String, required: true },

    location: { type: String, required: true },
    county: { type: String, required: true },
    town: { type: String, default: "" },
    address: { type: String, default: "" },
    mapLink: { type: String, default: "" },

    price: { type: Number, required: true, min: 0 },
    weekendPrice: { type: Number },
    peakPrice: { type: Number },

    amenities: { type: [String], default: [] },
    roomTypes: { type: [roomTypeSchema], default: [] },

    policies: {
      checkIn: { type: String, default: "14:00" },
      checkOut: { type: String, default: "11:00" },
      cancellation: { type: String, default: "48" },
      payment: { type: String, default: "M-Pesa, Visa, Mastercard accepted" },
    },

    bookingUrl: { type: String, default: "" },

    manager: {
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
      whatsapp: { type: String, default: "" },
    },

    advertisingPackage: {
      name: { type: String, enum: ["Starter", "Growth", "Premium", ""], default: "" },
      duration: { type: String, default: "" },
      price: { type: Number, default: 0 },
    },

    color: { type: String, default: "#0ea5e9" },
    tag: { type: String, default: null },
    emoji: { type: String, default: "🏨" },
    shortDesc: { type: String, default: "" },
    images: { type: [String], default: [] },
    videos: { type: [String], default: [] },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "sold"],
      default: "pending",
    },
    isFeatured: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
    reviews: { type: [reviewSchema], default: [] },
  },
  { timestamps: true }
);

tourismListingSchema.index({ status: 1, category: 1, county: 1, price: 1 });
tourismListingSchema.index({ isFeatured: 1, status: 1 });

const TourismListing =
  mongoose.models.TourismListing ||
  mongoose.model("TourismListing", tourismListingSchema, "tourismlistings");

export default TourismListing;
