import mongoose from "mongoose";

const verificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    verificationLevel: {
      type: Number,
      enum: [1, 2, 3, 4],
      default: 1,
    },
    status: {
      type: String,
      enum: ["pending", "under_review", "approved", "rejected"],
      default: "pending",
    },
    documents: [
      {
        type: {
          type: String,
          enum: ["national_id", "passport", "driver_license", "utility_bill", "bank_statement", "business_registration", "student_id", "physical_verification"],
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        filename: {
          type: String,
          required: true,
        },
        mimetype: {
          type: String,
          required: true,
        },
        size: {
          type: Number,
          required: true,
        },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        rejectionReason: {
          type: String,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    selfie: {
      url: {
        type: String,
      },
      filename: {
        type: String,
      },
      mimetype: {
        type: String,
      },
      size: {
        type: Number,
      },
      faceMatchScore: {
        type: Number,
        min: 0,
        max: 100,
      },
      uploadedAt: {
        type: Date,
      },
    },
    // Level 2: Identity Verification
    idType: {
      type: String,
      enum: ["national_id", "passport", "driver_license"],
    },
    // Level 3: Address Verification
    addressDocument: {
      type: mongoose.Schema.Types.ObjectId,
    },
    // Level 4: Business Verification
    businessName: {
      type: String,
    },
    businessRegistration: {
      type: mongoose.Schema.Types.ObjectId,
    },
    taxId: {
      type: String,
    },
    physicalDetails: {
      type: String,
    },
    // Review information
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: {
      type: Date,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    rejectionReason: {
      type: String,
    },
    adminNotes: {
      type: String,
    },
    // Metadata
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  { timestamps: true }
);

// Index for faster queries
verificationSchema.index({ user: 1, status: 1 });
verificationSchema.index({ status: 1, submittedAt: -1 });

const Verification = mongoose.models.Verification || mongoose.model("Verification", verificationSchema, "verifications");

export default Verification;
