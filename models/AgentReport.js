import mongoose from "mongoose";

const agentReportSchema = new mongoose.Schema(
  {
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rental: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
    },
    reason: {
      type: String,
      enum: ["no_show", "fake_listing", "payment_requested", "other"],
      required: true,
    },
    details: {
      type: String,
      trim: true,
    },
    reporterContact: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["open", "reviewed", "actioned"],
      default: "open",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    actionTaken: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
agentReportSchema.index({ agent: 1, status: 1 });
agentReportSchema.index({ status: 1 });
agentReportSchema.index({ createdAt: -1 });

export default mongoose.models.AgentReport || mongoose.model("AgentReport", agentReportSchema);
