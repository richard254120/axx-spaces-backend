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
  images: [String],
  image: { type: String },
  lat: { type: Number },
  lng: { type: Number },
  
  // ✅ Ownership
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Caretaker who uploaded
  
  // ✅ SIMPLE approval flow: pending → landlord_approved → admin_approved → live
  status: { 
    type: String, 
    enum: ['pending', 'landlord_approved', 'admin_approved'], 
    default: 'pending' 
  },
  
  // ✅ Track approvals
  landlordApprovedAt: { type: Date, default: null },
  adminApprovedAt: { type: Date, default: null },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('Property', propertySchema);