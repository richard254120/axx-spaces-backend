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
  targetLocation: {
    type: String,
    default: ""
  },
  pickupLocation: {
    type: String,
    default: ""
  },
  dropoffLocation: {
    type: String,
    default: ""
  },
  budgetMin: {
    type: Number,
    default: null
  },
  budgetMax: {
    type: Number,
    default: null
  },
  budgetCurrency: {
    type: String,
    default: "KES"
  },
  budgetPeriod: {
    type: String,
    default: "total"
  },
  urgency: {
    type: String,
    enum: ["immediate", "this_week", "this_month", "flexible"],
    default: "flexible"
  },
  preferredContact: {
    type: String,
    enum: ["whatsapp", "phone", "email"],
    default: "whatsapp"
  },
  categorySpecifics: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
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
