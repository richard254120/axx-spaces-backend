import mongoose from "mongoose";

const agentQRScanSchema = new mongoose.Schema(
  {
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    scannedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    source: {
      type: String,
      enum: ["poster", "business_card", "flyer", "website", "social_media", "generic"],
      default: "generic",
    },
    userAgent: String,
    ip: String,
    location: {
      lat: Number,
      lng: Number,
      city: String,
      country: String,
    },
    device: {
      type: {
        type: String,
        enum: ["mobile", "tablet", "desktop", "unknown"],
        default: "unknown",
      },
      os: String,
      browser: String,
    },
  },
  { timestamps: true }
);

// Compound index for efficient date-range queries
agentQRScanSchema.index({ agent: 1, scannedAt: -1 });

const AgentQRScan = mongoose.models.AgentQRScan || mongoose.model("AgentQRScan", agentQRScanSchema);

export default AgentQRScan;
