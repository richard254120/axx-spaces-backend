// models/Boost.js
const mongoose = require("mongoose");

const boostSchema = new mongoose.Schema({
    listing: { type: mongoose.Schema.Types.ObjectId, refPath: "listingModel" },
    listingModel: { type: String, enum: ["Property", "Material", "Tourism"], required: true },
    listingTitle: { type: String },          // denormalized for quick display
    listingType: { type: String },           // "property" | "material" | "tourism"

    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String },
    userPhone: { type: String },

    plan: { type: String, enum: ["3weeks", "4months", "6months"], required: true },
    amount: { type: Number, required: true },

    // Plan details
    planDuration: { type: Number, required: true }, // in days
    planPrice: { type: Number, required: true }, // in KES

    // M-Pesa payment details (filled by user on submission)
    mpesaRef: { type: String },
    transactionRef: { type: String },

    status: {
        type: String,
        enum: ["pending", "approved", "rejected", "expired"],
        default: "pending",
        index: true,
    },

    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },
    expiresAt: { type: Date },              // set on approval based on plan duration
}, { timestamps: true });

module.exports = mongoose.model("Boost", boostSchema);