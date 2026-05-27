import mongoose from "mongoose";

const materialInquirySchema = new mongoose.Schema(
  {
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material",
      required: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: [true, "Please provide a message"],
    },
    status: {
      type: String,
      enum: ["pending", "replied", "completed", "cancelled"],
      default: "pending",
    },
    replies: [
      {
        sender: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        message: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
    respondedAt: Date,
  },
  { timestamps: true }
);

const MaterialInquiry =
  mongoose.models.MaterialInquiry ||
  mongoose.model("MaterialInquiry", materialInquirySchema, "materialinquiries");

export default MaterialInquiry;