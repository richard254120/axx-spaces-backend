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
      unique: true,
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
      unique: true,
      trim: true,
    },
    profileImage: {
      type: String,
      default: "",
    },
    // ✅ ROLE IDENTIFICATION — added "seller"
    role: {
      type: String,
      enum: ["user", "mover", "admin", "landlord", "seller", "seller"],
      default: "user",
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
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema, "users");
export default User;