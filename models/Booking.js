import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    guest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    accommodation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Accommodation",
      required: true,
    },
    roomType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RoomType",
      required: true,
    },
    checkIn: {
      type: Date,
      required: [true, "Please provide check-in date"],
    },
    checkOut: {
      type: Date,
      required: [true, "Please provide check-out date"],
    },
    numberOfGuests: {
      type: Number,
      required: [true, "Please provide number of guests"],
      min: 1,
    },
    totalPrice: {
      type: Number,
      required: [true, "Please provide total price"],
      min: 0,
    },
    cleaningFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    serviceFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    cancelledAt: {
      type: Date,
    },
    specialRequests: {
      type: String,
      trim: true,
    },
    // Contact information for the booking
    guestContact: {
      name: String,
      email: String,
      phone: String,
    },
  },
  { timestamps: true }
);

// Validate check-out is after check-in
bookingSchema.pre("save", function (next) {
  if (this.checkOut <= this.checkIn) {
    return next(new Error("Check-out date must be after check-in date"));
  }
  next();
});

// Index for efficient queries
bookingSchema.index({ guest: 1, status: 1 });
bookingSchema.index({ accommodation: 1, status: 1 });
bookingSchema.index({ roomType: 1, checkIn: 1, checkOut: 1 });

const Booking = mongoose.models.Booking || mongoose.model("Booking", bookingSchema, "bookings");

export default Booking;
