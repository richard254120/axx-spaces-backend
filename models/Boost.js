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

    plan: { type: String, enum: ["weekly", "monthly"], required: true },
    amount: { type: Number, required: true },

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
    expiresAt: { type: Date },              // set on approval: now + 7 or 30 days
}, { timestamps: true });

module.exports = mongoose.model("Boost", boostSchema);