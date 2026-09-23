import mongoose from "mongoose";

const availabilitySchema = new mongoose.Schema(
  {
    roomType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RoomType",
      required: true,
    },
    date: {
      type: Date,
      required: [true, "Please provide date"],
    },
    availableUnits: {
      type: Number,
      required: [true, "Please provide available units"],
      min: 0,
    },
    price: {
      type: Number,
      min: 0,
    }, // Optional: allows for dynamic pricing per date
    isBlocked: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Compound index to prevent duplicate availability entries for same room on same date
availabilitySchema.index({ roomType: 1, date: 1 }, { unique: true });

const Availability = mongoose.models.Availability || mongoose.model("Availability", availabilitySchema, "availability");

export default Availability;
