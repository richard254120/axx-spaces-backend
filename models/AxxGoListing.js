import mongoose from "mongoose";

const axxGoListingSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: ["Rentals", "Accommodation", "AxxBiashara", "Quick Sales"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [140, "Title cannot exceed 140 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [4000, "Description cannot exceed 4000 characters"],
    },
    price: {
      type: Number,
      default: 0,
      min: [0, "Price cannot be negative"],
    },
    priceType: {
      type: String,
      enum: ["fixed", "negotiable", "contact_for_price"],
      default: "fixed",
    },
    pricePeriod: {
      type: String,
      enum: ["one-off", "per-month", "per-night"],
      default: "one-off",
    },
    location: {
      county: {
        type: String,
        required: [true, "County is required"],
        trim: true,
      },
      area: {
        type: String,
        required: [true, "Specific area is required"],
        trim: true,
      },
    },
    photos: {
      type: [String],
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.length >= 1 && val.length <= 8;
        },
        message: "Must provide between 1 and 8 photos",
      },
    },
    // The authenticated AxxSpace user who published this listing
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    poster: {
      name: {
        type: String,
        required: [true, "Poster name is required"],
        trim: true,
      },
      phone: {
        type: String,
        required: [true, "Phone number is required"],
        trim: true,
      },
      whatsapp: {
        type: String,
        trim: true,
        default: "",
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        default: "",
      },
    },
    // Category-specific fields
    categoryFields: {
      // Rentals
      propertyType: { type: String, default: "" },
      bedrooms: { type: Number, default: null },
      bathrooms: { type: Number, default: null },
      deposit: { type: Number, default: null },
      availabilityDate: { type: String, default: "" },

      // Accommodation
      accommodationType: { type: String, default: "" }, // hostel, airbnb, hotel, room
      amenities: { type: [String], default: [] }, // WiFi, water, parking, security, etc.
      capacity: { type: String, default: "" },

      // AxxBiashara
      businessName: { type: String, default: "" },
      businessType: { type: String, default: "" }, // services, shops, products, business promotions
      openingHours: { type: String, default: "" },
      websiteLink: { type: String, default: "" },
      socialLink: { type: String, default: "" },

      // Quick Sales
      itemCondition: { type: String, default: "" }, // new, used - like new, used - good, used - fair
      brand: { type: String, default: "" },
      reasonForSelling: { type: String, default: "" },
    },
    status: {
      type: String,
      enum: ["active", "sold", "rented", "unavailable", "hidden", "expired"],
      default: "active",
      index: true,
    },
    // Secret token for account-free edit/status/delete operations
    manageToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    reportCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    views: {
      type: Number,
      default: 0,
      min: 0,
    },
    ip: {
      type: String,
      default: "",
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for optimal search and filtering
axxGoListingSchema.index({ status: 1, category: 1, createdAt: -1 });
axxGoListingSchema.index({ status: 1, "location.county": 1, createdAt: -1 });
axxGoListingSchema.index({ status: 1, price: 1 });
axxGoListingSchema.index(
  {
    title: "text",
    description: "text",
    "location.area": "text",
    "categoryFields.businessName": "text",
  },
  {
    weights: {
      title: 10,
      "categoryFields.businessName": 8,
      "location.area": 5,
      description: 2,
    },
    name: "AxxGoTextIndex",
  }
);

const AxxGoListing =
  mongoose.models.AxxGoListing || mongoose.model("AxxGoListing", axxGoListingSchema);

export const AxxJunksListing = AxxGoListing;
export default AxxGoListing;

