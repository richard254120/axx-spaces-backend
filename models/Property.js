import mongoose from 'mongoose';

const propertySchema = new mongoose.Schema({
  title: { type: String, required: true },
  county: { type: String, required: true },
  area: { type: String, required: true },
  price: { type: Number, required: true },
  deposit: { type: Number },
  type: { type: String, required: true },
  bedrooms: { type: Number },
  bathrooms: { type: Number },
  amenities: [{ type: String }],
  description: { type: String },
  phone: { type: String, required: true },
  
  // ✅ FIXED — Support both single image and multiple images
  image: { type: String }, // Single image (for backward compatibility)
  images: [{ type: String }], // Multiple images (from Cloudinary)
  
  lat: { type: Number },
  lng: { type: Number },
  
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Property', propertySchema);