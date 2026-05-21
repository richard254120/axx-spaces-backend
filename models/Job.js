// models/Job.js
import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  mover: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Assigned mover
  serviceType: { type: String, required: true },
  pickupLocation: { type: String, required: true },
  dropoffLocation: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'active', 'completed'], 
    default: 'pending' 
  },
  notes: String,
  scheduledDate: { type: Date, required: true }
}, { timestamps: true });

export default mongoose.model("Job", jobSchema);