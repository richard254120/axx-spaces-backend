import mongoose from "mongoose";

const sellerVerificationSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    businessName: {
      type: String,
      required: [true, "Please provide business name"],
    },
    businessRegNumber: {
      type: String,
      required: [true, "Please provide business registration number"],
    },
    kraPin: {
      type: String,
      required: [true, "Please provide KRA PIN"],
    },
    idNumber: {
      type: String,
      required: [true, "Please provide national ID number"],
    },
    documents: [String], // Cloudinary URLs (KRA, ID, Business Reg)

    // VERIFICATION STATUS
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    verifiedAt: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Admin user
    },
    rejectionReason: String,

    // SELLER STATS
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    completedTransactions: {
      type: Number,
      default: 0,
    },
    responseTime: {
      type: Number,
      default: 0, // Average hours
    },

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

const SellerVerification =
  mongoose.models.SellerVerification ||
  mongoose.model("SellerVerification", sellerVerificationSchema);

export default SellerVerification;