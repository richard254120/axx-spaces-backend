import mongoose from "mongoose";

const qrScanSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["gate", "building_outside", "noticeboard", "shop_nearby", "office", "vacancy_sign", "generic"],
      default: "generic",
    },
    scannedAt: {
      type: Date,
      default: Date.now,
    },
    userAgent: String,
    ip: String,
    location: {
      lat: Number,
      lng: Number,
      city: String,
      country: String,
    },
    convertedToInquiry: {
      type: Boolean,
      default: false,
    },
    inquiryType: {
      type: String,
      enum: ["whatsapp", "call", "booking", "none"],
      default: "none",
    },
    inquiredAt: Date,
  },
  { timestamps: true }
);

const QRScan = mongoose.models.QRScan || mongoose.model("QRScan", qrScanSchema);

export default QRScan;
