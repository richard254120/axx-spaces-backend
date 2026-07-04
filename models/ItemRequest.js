import mongoose from "mongoose";

const ItemRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: false
  },
  serviceType: {
    type: String,
    enum: ["rental", "mover", "material", "tourism", "business", "other"],
    default: "other",
    required: true
  },
  searchQuery: {
    type: String,
    required: true
  },
  details: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "contacted", "resolved"],
    default: "pending"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const ItemRequest = mongoose.model("ItemRequest", ItemRequestSchema);
export default ItemRequest;
