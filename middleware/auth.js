import mongoose from 'mongoose';

const propertySchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  county: { 
    type: String, 
    required: true 
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
    type: String, 
    required: true 
  },
  images: [String],
  image: { 
    type: String 
  }, // backward compatibility
  lat: { 
    type: Number 
  },
  lng: { 
    type: Number 
  },

  // Ownership & caretaker
  owner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  uploadedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },

  // Three-tier approval system
  status: { 
    type: String, 
    enum: ['pending', 'landlord_approved', 'admin_approved', 'rejected'], 
    default: 'pending' 
  },

  // Approval trail
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

// Safe model registration to prevent OverwriteModelError
const Property = mongoose.models.Property || mongoose.model('Property', propertySchema);

export default Property;