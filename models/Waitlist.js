import mongoose from "mongoose";

const waitlistSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    // Landlord who owns the property
    landlord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Person waiting — they may or may not have an account
    name: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email address is required"],
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
    // FIFO position — set to Date.now at creation; sort ascending = first-come first-served
    position: {
      type: Date,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: ["waiting", "notified", "removed"],
      default: "waiting",
    },
    // Track when landlord sent the "unit is available" notification
    notifiedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Prevent the same person (by email) from joining the same property waitlist twice
waitlistSchema.index({ property: 1, email: 1 }, { unique: true });

const Waitlist =
  mongoose.models.Waitlist || mongoose.model("Waitlist", waitlistSchema);

export default Waitlist;
