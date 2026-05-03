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
  
  // ✅ IMAGES
  images: [String],
  image: { 
    type: String 
  },
  lat: { 
    type: Number 
  },
  lng: { 
    type: Number 
  },

  // ✅ OWNERSHIP
  owner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },

  // ✅ BOOKING STATUS (Professional flow)
  bookingStatus: { 
    type: String, 
    enum: ['available', 'pending_booking', 'booked'], 
    default: 'available' 
  },

  // ✅ BOOKING REQUESTS (Array for multiple requests)
  bookingRequests: [{
    tenant: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    tenantName: String,
    tenantPhone: String,
    tenantEmail: String,
    preferredMoveInDate: Date,
    requestMessage: String,
    status: { 
      type: String, 
      enum: ['pending', 'accepted', 'rejected'], 
      default: 'pending' 
    },
    requestedAt: { 
      type: Date, 
      default: Date.now 
    },
    respondedAt: Date,
    rejectionReason: String
  }],

  // ✅ CURRENT BOOKING (When accepted)
  currentBooking: {
    tenant: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    tenantName: String,
    tenantPhone: String,
    tenantEmail: String,
    bookedAt: Date,
    expectedMoveInDate: Date
  },

  // ✅ ADMIN APPROVAL
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },

  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

// Safe model registration
const Property = mongoose.models.Property || mongoose.model('Property', propertySchema);

export default Property;