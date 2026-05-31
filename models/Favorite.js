import mongoose from "mongoose";

const favoriteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Business",
    required: true,
  },
  notes: {
    type: String,
    default: "",
  },
  category: {
    type: String,
    default: "general",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

favoriteSchema.index({ user: 1, business: 1 }, { unique: true });
favoriteSchema.index({ user: 1, createdAt: -1 });

const Favorite = mongoose.models.Favorite || mongoose.model("Favorite", favoriteSchema);

export default Favorite;
