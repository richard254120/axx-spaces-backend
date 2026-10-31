import mongoose from "mongoose";

// One document per user per day — counts lead-access contact reveals.
const contactRevealSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  day: { type: String, required: true }, // YYYY-MM-DD (Africa/Nairobi)
  count: { type: Number, default: 0 },
  history: [{
    listing: mongoose.Schema.Types.ObjectId,
    listingModel: { type: String, enum: ["Property", "Accommodation"] },
    at: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

contactRevealSchema.index({ user: 1, day: 1 }, { unique: true });

export default mongoose.models.ContactReveal || mongoose.model("ContactReveal", contactRevealSchema);
