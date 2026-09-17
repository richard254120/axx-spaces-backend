import mongoose from "mongoose";

const roomTypeSchema = new mongoose.Schema(
  {
    accommodation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Accommodation",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Please provide room/unit name"],
      trim: true,
    },
    capacity: {
      type: Number,
      required: [true, "Please provide capacity"],
      min: 1,
    },
    pricePerNight: {
      type: Number,
      required: [true, "Please provide price per night"],
      min: 0,
    },
    quantity: {
      type: Number,
      required: [true, "Please provide quantity available"],
      min: 1,
    },
    amenities: [{
      type: String,
    }],
    description: {
      type: String,
      trim: true,
    },
    size: {
      type: String, // e.g., "30 sqm"
      trim: true,
    },
    bedType: {
      type: String, // e.g., "King", "Queen", "Twin"
      trim: true,
    },
  },
  { timestamps: true }
);

const RoomType = mongoose.models.RoomType || mongoose.model("RoomType", roomTypeSchema, "roomtypes");

export default RoomType;
