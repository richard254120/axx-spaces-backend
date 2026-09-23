import mongoose from "mongoose";

const agentRequestSchema = new mongoose.Schema(
  {
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    agentMessage: {
      type: String,
      trim: true,
    },
    providerResponse: {
      type: String,
      trim: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
agentRequestSchema.index({ agent: 1, provider: 1, status: 1 });
agentRequestSchema.index({ provider: 1, status: 1 });

export default mongoose.model("AgentRequest", agentRequestSchema);
