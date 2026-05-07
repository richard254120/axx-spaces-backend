import mongoose from "mongoose";

const propertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please provide title"],
    },
    description: {
      type: String,
      required: [true, "Please provide description"],
      minlength: 50,
    },
    location: {
      type: String,
      required: [true, "Please provide location"],
    },
    price: {
      type: Number,
      required: [true, "Please provide price"],
    },

    deposit: { type: Number, default: 0 },
    furnished: { type: Boolean, default: false },
    leaseType: {
      type: String,
      enum: ["monthly", "6months", "yearly"],
      default: "monthly",
    },
    availableFrom: { type: Date },
    rules: { type: String, default: "" },

    bedrooms: { type: Number, required: true },
    bathrooms: { type: Number, required: true },
    amenities: [String],
    images: [String],

    // BOOKING SYSTEM
    totalUnits: { type: Number, required: true, default: 1, min: 1 },
    bookedUnits: { type: Number, default: 0, min: 0 },

    // Computed field
    availableUnits: { type: Number, default: 0 },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// ✅ Always keep availableUnits accurate
propertySchema.pre("save", function (next) {
  this.availableUnits = Math.max(0, this.totalUnits - this.bookedUnits);
  next();
});

const Property = mongoose.models.Property || mongoose.model("Property", propertySchema);

export default Property;