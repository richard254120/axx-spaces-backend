import mongoose from 'mongoose';

const propertySchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  location: { // Added to match your route logic
    type: String, 
    required: true 
  },
  county: { 
    type: String 
  },
  area: { 
    type: String 
  },
  price: { 
    type: Number, 
    required: true 
  },
  deposit: { 
    type: Number 
  },
  type: { 
    type: String 
  },
  bedrooms: { 
    type: Number 
  },
  bathrooms: { 
    type: Number 
  },
  amenities: [String],
  description: { 
    type: String 
  },
  phone: { 
    type: String 
  },
  images: [String],
  image: { 
    type: String 
  }, 
  lat: { type: Number },
  lng: { type: Number },

  // Unit Management (Required for the 'mark-booked' route)
  totalUnits: { 
    type: Number, 
    default: 1 
  },
  bookedUnits: { 
    type: Number, 
    default: 0 
  },

  // Ownership
  owner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  uploadedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },

  // Approval system
  status: { 
    type: String, 
    enum: ['pending', 'landlord_approved', 'admin_approved', 'rejected'], 
    default: 'pending' 
  },

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
  }
}, { 
  timestamps: true 
});

const Property = mongoose.models.Property || mongoose.model('Property', propertySchema);

export default Property;