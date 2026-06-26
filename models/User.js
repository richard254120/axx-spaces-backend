import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide name"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please provide email"],
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Please provide password"],
      minlength: 6,
      select: false,
    },
    phone: {
      type: String,
      required: [true, "Please provide phone"],
      trim: true,
    },
    profileImage: {
      type: String,
      default: "",
    },
    // ✅ ROLE IDENTIFICATION — added "seller" and "team"
    role: {
      type: String,
      enum: ["user", "mover", "admin", "landlord", "seller", "team"],
      default: "user",
    },
    landlordType: {
      type: String,
      enum: ["general", "university"],
      default: "general",
    },

    // ✅ MOVER SPECIFIC FIELDS
    isApproved: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    county: {
      type: String,
      trim: true,
    },
    experienceYears: {
      type: Number,
      default: 0,
    },
    vehicleType: {
      type: String,
    },
    services: {
      type: [String],
      default: [],
    },
    description: {
      type: String,
      trim: true,
    },
    // Enhanced mover fields
    portfolioImages: {
      type: [String],
      default: [],
    },
    pricing: {
      baseRate: {
        type: Number,
        default: 0,
      },
      rateType: {
        type: String,
        enum: ["hourly", "per_job", "per_km", "fixed"],
        default: "per_job",
      },
      minCharge: {
        type: Number,
        default: 0,
      },
      additionalServices: [
        {
          service: String,
          price: Number,
        },
      ],
    },
    certifications: [
      {
        name: String,
      },
    ],
    insurance: {
      hasInsurance: {
        type: Boolean,
        default: false,
      },
      provider: String,
      coverageAmount: Number,
      expiryDate: Date,
    },
    teamInfo: {
      teamSize: {
        type: Number,
        default: 1,
      },
      teamMembers: [
        {
          name: String,
          role: String,
        },
      ],
    },
    availability: {
      availableDays: {
        type: [String],
        default: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      },
      availableHours: {
        start: String,
        end: String,
      },
      noticeRequired: {
        type: Number,
        default: 24,
      },
    },
    serviceAreas: {
      type: [String],
      default: [],
    },
    fleetDetails: [
      {
        vehicleType: String,
        capacity: String,
        count: Number,
      },
    ],
    responseTime: {
      type: String,
      default: "Within 2 hours",
    },
    specialties: {
      type: [String],
      default: [],
    },

    // ✅ EXISTING MONETIZATION FIELDS
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentHistory: [
      {
        transactionId: String,
        amount: Number,
        plan: String,
        propertyId: mongoose.Schema.Types.ObjectId,
        materialId: mongoose.Schema.Types.ObjectId,
        subscriptionType: String,
        paymentMethod: String,
        transactionRef: String,
        bankMessage: String,
        status: {
          type: String,
          enum: ["pending", "success", "failed", "cancelled"],
          default: "pending",
        },
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    promotedListings: [
      {
        propertyId: mongoose.Schema.Types.ObjectId,
        tier: String,
        startDate: Date,
        endDate: Date,
      },
    ],

    // ✅ PASSWORD RESET FIELDS
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpiry: {
      type: Date,
    },

    // ✅ EMAIL VERIFICATION FIELDS
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
    },
    emailVerificationExpiry: {
      type: Date,
    },

    // ✅ GOOGLE OAUTH FIELDS
    googleId: {
      type: String,
    },
    isGoogleUser: {
      type: Boolean,
      default: false,
    },

    // ✅ KYC VERIFICATION FIELDS
    verificationLevel: {
      type: Number,
      enum: [1, 2, 3, 4],
      default: 1,
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "under_review", "approved", "rejected"],
      default: "pending",
    },
    verificationBadges: {
      type: [String],
      default: [],
    },
    studentVerificationStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },
    standardVerificationStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },
    premiumVerificationStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema, "users");
export default User;