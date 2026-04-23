import mongoose from "mongoose";

const propertySchema = new mongoose.Schema(
  {
    title: String,
    county: String,
    area: String,
    price: Number,
    type: String,
    bedrooms: String,
    bathrooms: String,
    description: String,
    phone: String,
    amenities: [String],
    image: String,
    status: {
      type: String,
      default: "pending",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Property", propertySchema);