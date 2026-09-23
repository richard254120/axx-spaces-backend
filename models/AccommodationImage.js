import mongoose from "mongoose";

const accommodationImageSchema = new mongoose.Schema(
  {
    accommodation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Accommodation",
      required: true,
    },
    imageUrl: {
      type: String,
      required: [true, "Please provide image URL"],
    },
    order: {
      type: Number,
      default: 0,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    caption: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Ensure only one primary image per accommodation
accommodationImageSchema.pre("save", async function (next) {
  if (this.isPrimary) {
    await this.constructor.updateMany(
      { accommodation: this.accommodation, _id: { $ne: this._id } },
      { isPrimary: false }
    );
  }
  next();
});

const AccommodationImage = mongoose.models.AccommodationImage || mongoose.model("AccommodationImage", accommodationImageSchema, "accommodationimages");

export default AccommodationImage;
