import mongoose from "mongoose";

const axxGoReportSchema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AxxGoListing",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: [true, "Report reason is required"],
      enum: ["scam", "wrong_category", "offensive", "sold", "other"],
    },
    details: {
      type: String,
      trim: true,
      default: "",
    },
    reporterContact: {
      type: String,
      trim: true,
      default: "",
    },
    ip: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["open", "reviewed", "dismissed", "actioned"],
      default: "open",
      index: true,
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
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

axxGoReportSchema.index({ listing: 1, createdAt: -1 });
axxGoReportSchema.index({ status: 1, createdAt: -1 });

const AxxGoReport =
  mongoose.models.AxxGoReport || mongoose.model("AxxGoReport", axxGoReportSchema);

export default AxxGoReport;

