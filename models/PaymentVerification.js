import mongoose from "mongoose";

const paymentVerificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: false,
    },
    tourismPropertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TourismListing",
      required: false,
    },
    type: {
      type: String,
      enum: ["listing_boost", "premium_plan", "tourism_package", "other"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    mpesaMessage: {
      type: String,
      required: true,
    },
    mpesaTransactionId: {
      type: String,
      required: false,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    plan: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    adminNotes: {
      type: String,
      default: "",
    },
    processedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

const PaymentVerification = mongoose.models.PaymentVerification || mongoose.model("PaymentVerification", paymentVerificationSchema);

export default PaymentVerification;
