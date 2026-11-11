import mongoose from "mongoose";

const axxGoBannedSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["phone", "ip"],
    },
    value: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    reason: {
      type: String,
      default: "Violation of terms",
    },
    bannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

axxGoBannedSchema.index({ type: 1, value: 1 }, { unique: true });

const AxxGoBanned =
  mongoose.models.AxxGoBanned || mongoose.model("AxxGoBanned", axxGoBannedSchema);

export default AxxGoBanned;

