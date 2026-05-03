import mongoose from 'mongoose';

const propertySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
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

  // Images
  images: [String],
  image: String,

  // Location
  lat: Number,
  lng: Number,

  // ✅ NEW ADDITIONAL FIELDS
  size: String,
  floor: String,
  yearBuilt: String,
  furnishing: String,
  parking: String,
  petPolicy: String,
  utilitiesIncluded: String,

  // Ownership & Status
  owner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  bookingStatus: { 
    type: String, 
    enum: ['available', 'pending_booking', 'booked'], 
    default: 'available' 
  },

  bookingRequests: [{
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tenantName: String,
    tenantPhone: String,
    tenantEmail: String,
    preferredMoveInDate: Date,
    requestMessage: String,
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    requestedAt: { type: Date, default: Date.now },
    respondedAt: Date,
    rejectionReason: String
  }],

  currentBooking: {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tenantName: String,
    tenantPhone: String,
    tenantEmail: String,
    bookedAt: Date,
    expectedMoveInDate: Date
  },

}, { timestamps: true });

const Property = mongoose.models.Property || mongoose.model('Property', propertySchema);
export default Property;