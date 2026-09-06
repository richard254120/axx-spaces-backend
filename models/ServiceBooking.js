import mongoose from "mongoose";

const serviceBookingSchema = new mongoose.Schema(
  {
    service: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "serviceType",
      required: true
    },
    serviceType: {
      type: String,
      enum: ["home-service", "professional-service", "event-service", "automotive-service"],
      required: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    
    // Booking details
    date: {
      type: Date,
      required: true
    },
    time: {
      type: String,
      required: true
    },
    duration: {
      type: Number, // in hours
      default: 1
    },
    address: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    
    // Pricing
    estimatedCost: {
      type: Number,
      required: true
    },
    finalCost: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: "KES"
    },
    
    // Status tracking
    status: {
      type: String,
      enum: ["pending", "confirmed", "in-progress", "completed", "cancelled", "no-show"],
      default: "pending",
      index: true
    },
    
    // Payment
    paymentStatus: {
      type: String,
      enum: ["pending", "partial", "paid", "refunded"],
      default: "pending"
    },
    paymentMethod: String,
    paymentId: String,
    
    // Timeline
    confirmedAt: Date,
    startedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    cancellationReason: String,
    
    // Communication
    notes: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      note: String,
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    // Rating and review
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    review: String,
    ratedAt: Date,
    
    // Service completion details
    completionDetails: {
      workCompleted: String,
      beforePhotos: [String],
      afterPhotos: [String],
      materialsUsed: [String],
      additionalCharges: [{
        description: String,
        amount: Number
      }]
    },
    
    // Customer feedback
    customerFeedback: {
      communication: Number,
      professionalism: Number,
      quality: Number,
      timeliness: Number,
      overall: Number
    }
  },
  { 
    timestamps: true 
  }
);

// Indexes for efficient queries
serviceBookingSchema.index({ customer: 1, status: 1 });
serviceBookingSchema.index({ provider: 1, status: 1 });
serviceBookingSchema.index({ date: 1, status: 1 });
serviceBookingSchema.index({ serviceType: 1, status: 1 });

const ServiceBooking = mongoose.models.ServiceBooking || mongoose.model("ServiceBooking", serviceBookingSchema, "serviceBookings");

export default ServiceBooking;