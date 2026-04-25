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
  image: { type: String },
  lat: { type: Number },
  lng: { type: Number },

  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },

  owner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },

  createdAt: { type: Date, default: Date.now }
});

const Property = mongoose.model('Property', propertySchema);

export default Property;