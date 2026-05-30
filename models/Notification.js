const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["property_booking", "material_purchase", "tourism_booking", "boost", "subscription"],
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  userName: String,
  userPhone: String,
  userEmail: String,
  amount: Number,
  transactionId: String,
  mpesaRef: String,
  status: {
    type: String,
    enum: ["pending", "confirmed", "rejected"],
    default: "pending",
  },
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Property",
  },
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Material",
  },
  tourismId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TourismListing",
  },
  checkIn: Date,
  checkOut: Date,
  plan: String,
  subscriptionType: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  read: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("Notification", notificationSchema);
