import mongoose from "mongoose";

const agencySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide agency name"],
      trim: true,
    },
    registrationNumber: {
      type: String,
      required: [true, "Please provide registration number"],
      trim: true,
      unique: true,
    },
    phone: {
      type: String,
      required: [true, "Please provide phone"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please provide email"],
      lowercase: true,
      trim: true,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    agents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    address: {
      type: String,
      trim: true,
    },
    county: {
      type: String,
      trim: true,
    },
    logo: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
agencySchema.index({ admin: 1 });
agencySchema.index({ registrationNumber: 1 });

export default mongoose.models.Agency || mongoose.model("Agency", agencySchema);
