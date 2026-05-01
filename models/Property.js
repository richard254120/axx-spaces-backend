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
  image: { type: String }, // backward compat
  lat: { type: Number },
  lng: { type: Number },
  
  // ✅ Ownership & caretaker
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // ✅ NEW - caretaker who uploaded
  
  // ✅ NEW - Three-tier approval system
  status: { 
    type: String, 
    enum: ['pending', 'landlord_approved', 'admin_approved', 'rejected'], 
    default: 'pending' 
  },
  
  // ✅ NEW - Approval trail
  approvals: {
    landlord: { 
      approved: { type: Boolean, default: false },
      approvedAt: { type: Date, default: null },
      notes: { type: String }
    },
    admin: {
      approved: { type: Boolean, default: false },
      approvedAt: { type: Date, default: null },
      notes: { type: String }
    }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('Property', propertySchema);