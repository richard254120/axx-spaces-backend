import mongoose from "mongoose";

const businessInquirySchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Business",
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  subject: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  preferredContact: {
    type: String,
    enum: ["email", "phone", "whatsapp"],
    default: "email",
  },
  status: {
    type: String,
    enum: ["pending", "responded", "closed"],
    default: "pending",
  },
  response: {
    type: String,
  },
  respondedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

businessInquirySchema.index({ business: 1, createdAt: -1 });
businessInquirySchema.index({ user: 1 });
businessInquirySchema.index({ status: 1 });

const BusinessInquiry = mongoose.models.BusinessInquiry || mongoose.model("BusinessInquiry", businessInquirySchema);

export default BusinessInquiry;
