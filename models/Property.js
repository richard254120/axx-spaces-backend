import mongoose from 'mongoose';

const propertySchema = new mongoose.Schema({
  title: { type: String, required: true },
  county: { type: String, required: true },
  area: { type: String },
  price: { type: Number, required: true },
  deposit: { type: Number },
  type: { type: String },
  bedrooms: { type: Number },
  bathrooms: { type: Number },
  amenities: [String],
  description: { type: String },
  phone: { type: String, required: true },
  
  // ✅ IMAGES - Always array
  images: [String],
  image: { type: String }, // backward compat - first image
  
  lat: { type: Number },
  lng: { type: Number },
  
  // ✅ Simple ownership (no caretaker)
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // ✅ Simple status
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Safe model registration
const Property = mongoose.models.Property || mongoose.model('Property', propertySchema);

export default Property;