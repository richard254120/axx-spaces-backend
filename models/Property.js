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
    bedrooms: {
      type: Number,
      required: [true, "Please provide bedrooms"],
    },
    bathrooms: {
      type: Number,
      required: [true, "Please provide bathrooms"],
    },
    amenities: [String],
    images: [String],
    
    // BOOKED TRACKING FIELDS
    totalUnits: {
      type: Number,
      required: true,
      default: 1,
    },
    bookedUnits: {
      type: Number,
      default: 0,
    },
    availableUnits: {
      type: Number,
      default: function () {
        return this.totalUnits - this.bookedUnits;
      },
    },
    
    // OWNERSHIP & STATUS
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Please provide owner"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Middleware to calculate availableUnits before saving
propertySchema.pre("save", function (next) {
  this.availableUnits = this.totalUnits - this.bookedUnits;
  next();
});

const Property = mongoose.models.Property || mongoose.model("Property", propertySchema);

export default Property;