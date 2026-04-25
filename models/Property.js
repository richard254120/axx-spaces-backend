import mongoose from "mongoose";

const propertySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    county: { type: String, required: true },
    area: { type: String, required: true },
    price: { type: Number, required: true },
    deposit: { type: Number, required: true },
    type: { type: String, required: true },
    bedrooms: { type: String },
    bathrooms: { type: String },
    description: { type: String },
    phone: { type: String, required: true },
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