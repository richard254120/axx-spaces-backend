import mongoose from "mongoose";

const JobSchema = new mongoose.Schema({
  moverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  moverName: { type: String, required: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  serviceType: { type: String, required: true },
  pickupLocation: { type: String, required: true },
  dropoffLocation: { type: String, required: true },
  scheduledDate: { type: Date, required: true },
  notes: { type: String },
  county: { type: String, required: true },
  status: { type: String, enum: ["pending", "accepted", "rejected", "completed"], default: "pending" }
}, { timestamps: true });

export default mongoose.model("Job", JobSchema);