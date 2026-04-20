import mongoose from "mongoose";

const propertySchema = new mongoose.Schema({
  title: String,
  county: String,
  area: String,
  type: String,
  price: Number,
  deposit: Number,
  bedrooms: Number,
  bathrooms: Number,
  amenities: [String],
  description: String,
  phone: String,
  image: String,

  // ⭐ NEW MAP FIELDS
  lat: Number,
  lng: Number,

  status: {
    type: String,
    default: "pending"
  }
}, { timestamps: true });

// Create the model
const Property = mongoose.model("Property", propertySchema);

// ⭐ THE CRITICAL FIX: Add this line to satisfy the import in your routes
export default Property;