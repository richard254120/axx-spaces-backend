import mongoose from "mongoose";

const inquirySchema = new mongoose.Schema(
  {
    rental: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tenantIp: {
      type: String,
      trim: true,
    },
    tenantSessionId: {
      type: String,
      trim: true,
    },
    clickedAt: {
      type: Date,
      default: Date.now,
    },
    followUpStatus: {
      type: String,
      enum: ["pending", "connected", "no_response"],
      default: "pending",
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
inquirySchema.index({ rental: 1, agent: 1 });
inquirySchema.index({ agent: 1 });
inquirySchema.index({ tenantIp: 1, clickedAt: 1 });

export default mongoose.models.Inquiry || mongoose.model("Inquiry", inquirySchema);
