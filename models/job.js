import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
  customer:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  customerName:    { type: String },
  customerPhone:   { type: String, required: true },
  mover:           { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  moverName:       { type: String },
  serviceType:     { type: String, required: true },
  pickupLocation:  { type: String, required: true },
  dropoffLocation: { type: String, required: true },
  scheduledDate:   { type: Date, required: true },
  notes:           { type: String, default: "" },
  county:          { type: String },
  amount:          { type: Number, default: 0 },
  status: {
    type: String,
    enum: ["pending", "accepted", "active", "completed", "cancelled"],
    default: "pending",
  },
  acceptedAt:  { type: Date },
  completedAt: { type: Date },
}, { timestamps: true });

export default mongoose.model("Job", jobSchema);