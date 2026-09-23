import mongoose from "mongoose";

const accommodationSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    name: {
      type: String,
      required: [true, "Please provide accommodation name"],
      trim: true,
    },
    type: {
      type: String,
      enum: [
        "hotel", "bnb", "guesthouse", "apartment", "hostel", "villa", "cottage", "treehouse",
        "beach-resort", "city-hotel", "mountain-lodge", "safari-camp", "camping-grounds",
        "boutique-hotel", "eco-lodge", "glamping-site", "luxury-tented-camp", "safari-lodge",
        "game-lodge", "bush-camp", "airport-hotel", "business-hotel", "conference-hotel",
        "resort-hotel", "all-inclusive-resort", "family-resort", "adults-only-resort",
        "beach-hotel", "lake-resort", "river-lodge", "forest-lodge", "hill-station",
        "holiday-home"
      ],
      required: [true, "Please provide accommodation type"],
    },
    description: {
      type: String,
      required: [true, "Please provide description"],
      trim: true,
    },
    address: {
      type: String,
      required: [true, "Please provide address"],
      trim: true,
    },
    location: {
      lat: {
        type: Number,
        required: [true, "Please provide latitude"],
      },
      lng: {
        type: Number,
        required: [true, "Please provide longitude"],
      },
    },
    amenities: [{
      type: String,
    }],
    houseRules: {
      type: String,
      trim: true,
    },
    checkInTime: {
      type: String,
      default: "14:00",
    },
    checkOutTime: {
      type: String,
      default: "11:00",
    },
    maxGuests: {
      type: Number,
      required: [true, "Please provide maximum guests"],
      min: 1,
    },
    totalRooms: {
      type: Number,
      required: [true, "Please provide total number of rooms"],
      min: 1,
    },
    // Pricing fields
    basePrice: {
      type: Number,
      required: [true, "Please provide base price per night"],
      min: 0,
    },
    currency: {
      type: String,
      default: "KES",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "pending_review"],
      default: "pending_review",
      required: [true, "Please provide status"],
    },
    // Monetization fields
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
      enum: ["none", "boost-3days", "boost-7days", "boost-30days", "premium-30days"],
      default: "none",
    },
    views: {
      type: Number,
      default: 0,
    },
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

// Auto-unfeature expired promotions
accommodationSchema.pre("save", function (next) {
  if (this.isFeatured && this.promotionEndDate && new Date() > this.promotionEndDate) {
    this.isFeatured = false;
    this.promotionTier = "none";
  }
  next();
});

const Accommodation = mongoose.models.Accommodation || mongoose.model("Accommodation", accommodationSchema, "accommodations");

export default Accommodation;
