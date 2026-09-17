import express from "express";
import mongoose from "mongoose";
import Accommodation from "../models/Accommodation.js";
import RoomType from "../models/RoomType.js";
import Availability from "../models/Availability.js";
import Booking from "../models/Booking.js";
import Review from "../models/Review.js";
import User from "../models/User.js";
import { auth, adminOnly } from "../middleware/auth.js";
import security from "../middleware/security.js";

const router = express.Router();

// Helper function to calculate number of nights
const calculateNights = (checkIn, checkOut) => {
  const diffTime = Math.abs(new Date(checkOut) - new Date(checkIn));
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Helper function to check availability for dates
const checkAvailability = async (roomTypeId, checkIn, checkOut, requestedUnits = 1) => {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  checkInDate.setHours(0, 0, 0, 0);
  checkOutDate.setHours(0, 0, 0, 0);

  // Get all availability records for the date range
  const availabilityRecords = await Availability.find({
    roomType: roomTypeId,
    date: {
      $gte: checkInDate,
      $lt: checkOutDate
    }
  }).sort({ date: 1 });

  if (availabilityRecords.length === 0) {
    return { available: false, message: "No availability data for requested dates" };
  }

  // Check if any date is blocked or has insufficient units
  for (const record of availabilityRecords) {
    if (record.isBlocked) {
      return { available: false, message: `Date ${record.date.toISOString().split('T')[0]} is blocked` };
    }
    if (record.availableUnits < requestedUnits) {
      return { available: false, message: `Insufficient availability on ${record.date.toISOString().split('T')[0]}` };
    }
  }

  return { available: true };
};

// Helper function to calculate total price
const calculateTotalPrice = async (roomTypeId, checkIn, checkOut, numberOfGuests) => {
  const nights = calculateNights(checkIn, checkOut);
  const roomType = await RoomType.findById(roomTypeId);

  if (!roomType) {
    throw new Error("Room type not found");
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  checkInDate.setHours(0, 0, 0, 0);
  checkOutDate.setHours(0, 0, 0, 0);

  // Get availability records for pricing (some dates might have dynamic pricing)
  const availabilityRecords = await Availability.find({
    roomType: roomTypeId,
    date: {
      $gte: checkInDate,
      $lt: checkOutDate
    }
  });

  let totalRoomPrice = 0;

  if (availabilityRecords.length > 0) {
    // Use specific prices if available
    for (const record of availabilityRecords) {
      const price = record.price || roomType.pricePerNight;
      totalRoomPrice += price;
    }
  } else {
    // Fall back to base price
    totalRoomPrice = roomType.pricePerNight * nights;
  }

  // Calculate fees (could be configurable)
  const cleaningFee = Math.round(totalRoomPrice * 0.1); // 10% cleaning fee
  const serviceFee = Math.round(totalRoomPrice * 0.05); // 5% service fee
  const totalPrice = totalRoomPrice + cleaningFee + serviceFee;

  return {
    nights,
    basePrice: totalRoomPrice,
    cleaningFee,
    serviceFee,
    totalPrice,
  };
};

// ====================== CHECK AVAILABILITY ======================
// This must come before /:id routes
router.get("/check-availability", async (req, res) => {
  try {
    const { roomTypeId, checkIn, checkOut, guests } = req.query;

    if (!roomTypeId || !checkIn || !checkOut) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const roomType = await RoomType.findById(roomTypeId).populate("accommodation");
    if (!roomType) {
      return res.status(404).json({ error: "Room type not found" });
    }

    const numberOfGuests = parseInt(guests) || 1;
    if (numberOfGuests > roomType.capacity) {
      return res.status(400).json({
        error: `Room capacity is ${roomType.capacity} guests, but ${numberOfGuests} requested`
      });
    }

    // Check availability
    const availabilityCheck = await checkAvailability(roomTypeId, checkIn, checkOut, 1);

    if (!availabilityCheck.available) {
      return res.json({
        available: false,
        message: availabilityCheck.message,
      });
    }

    // Calculate price
    const pricing = await calculateTotalPrice(roomTypeId, checkIn, checkOut, numberOfGuests);

    res.json({
      available: true,
      roomType,
      pricing,
    });
  } catch (error) {
    console.error("Check availability error:", error);
    res.status(500).json({ error: error.message || "Failed to check availability" });
  }
});

// ====================== GET MY BOOKINGS (GUEST) ======================
// This must come before /:id routes
router.get("/my-bookings/all", auth, async (req, res) => {
  try {
    const { status } = req.query;
    const query = { guest: req.user._id };

    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate("accommodation", "name type address location images")
      .populate("roomType", "name capacity pricePerNight")
      .sort({ createdAt: -1 });

    // Get images for accommodations
    const accommodationIds = bookings.map(b => b.accommodation._id);
    const AccommodationImage = (await import("../models/AccommodationImage.js")).default;
    const images = await AccommodationImage.find({
      accommodation: { $in: accommodationIds },
      isPrimary: true
    });

    const imagesMap = {};
    images.forEach(img => {
      imagesMap[img.accommodation] = img.imageUrl;
    });

    const processed = bookings.map(booking => ({
      ...booking.toObject(),
      accommodation: {
        ...booking.accommodation.toObject(),
        primaryImage: imagesMap[booking.accommodation._id] || null,
      }
    }));

    res.json(processed);
  } catch (error) {
    console.error("Get my bookings error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch bookings" });
  }
});

// ====================== CREATE BOOKING ======================
router.post("/", auth, security.apiLimiter, async (req, res) => {
  try {
    const {
      accommodationId,
      roomTypeId,
      checkIn,
      checkOut,
      numberOfGuests,
      guestContact,
      specialRequests
    } = req.body;

    if (!accommodationId || !roomTypeId || !checkIn || !checkOut || !numberOfGuests) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate accommodation and room type
    const accommodation = await Accommodation.findById(accommodationId);
    if (!accommodation) {
      return res.status(404).json({ error: "Accommodation not found" });
    }

    if (accommodation.status !== "active") {
      return res.status(400).json({ error: "Accommodation is not active" });
    }

    const roomType = await RoomType.findById(roomTypeId);
    if (!roomType) {
      return res.status(404).json({ error: "Room type not found" });
    }

    if (roomType.accommodation.toString() !== accommodationId) {
      return res.status(400).json({ error: "Room type does not belong to this accommodation" });
    }

    if (numberOfGuests > roomType.capacity) {
      return res.status(400).json({
        error: `Room capacity is ${roomType.capacity} guests, but ${numberOfGuests} requested`
      });
    }

    // Check availability
    const availabilityCheck = await checkAvailability(roomTypeId, checkIn, checkOut, 1);
    if (!availabilityCheck.available) {
      return res.status(400).json({
        error: availabilityCheck.message || "Room not available for requested dates"
      });
    }

    // Calculate price
    const pricing = await calculateTotalPrice(roomTypeId, checkIn, checkOut, numberOfGuests);

    // Check for existing overlapping bookings (double-booking prevention)
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    const overlappingBookings = await Booking.countDocuments({
      roomType: roomTypeId,
      status: { $in: ["pending", "confirmed"] },
      $or: [
        {
          checkIn: { $lt: checkOutDate },
          checkOut: { $gt: checkInDate }
        }
      ]
    });

    if (overlappingBookings >= roomType.quantity) {
      return res.status(400).json({ error: "Room is already booked for these dates" });
    }

    // Create booking
    const booking = new Booking({
      guest: req.user._id,
      accommodation: accommodationId,
      roomType: roomTypeId,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      numberOfGuests: parseInt(numberOfGuests),
      totalPrice: pricing.totalPrice,
      cleaningFee: pricing.cleaningFee,
      serviceFee: pricing.serviceFee,
      status: "pending",
      paymentStatus: "pending",
      guestContact: guestContact || {
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
      },
      specialRequests: specialRequests || "",
    });

    await booking.save();

    // Update availability (optional: can be done after payment confirmation)
    // For now, we'll update it to prevent double-booking
    const current = new Date(checkInDate);
    while (current < checkOutDate) {
      await Availability.findOneAndUpdate(
        { roomType: roomTypeId, date: current },
        { $inc: { availableUnits: -1 } }
      );
      current.setDate(current.getDate() + 1);
    }

    console.log(`Booking created successfully | ID: ${booking._id} | Guest: ${req.user._id}`);

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking,
      pricing,
    });
  } catch (error) {
    console.error("Create booking error:", error);
    res.status(500).json({ error: error.message || "Failed to create booking" });
  }
});

// ====================== GET BOOKINGS FOR ACCOMMODATION (HOST) ======================
// This must come before /:id routes
router.get("/accommodation/:accommodationId/bookings", auth, async (req, res) => {
  try {
    const accommodation = await Accommodation.findById(req.params.accommodationId);
    if (!accommodation) {
      return res.status(404).json({ error: "Accommodation not found" });
    }

    if (accommodation.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied. You are not the owner of this accommodation." });
    }

    const { status } = req.query;
    const query = { accommodation: req.params.accommodationId };

    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate("guest", "name email phone profileImage")
      .populate("roomType", "name capacity pricePerNight")
      .sort({ checkIn: -1 });

    res.json(bookings);
  } catch (error) {
    console.error("Get accommodation bookings error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch bookings" });
  }
});

// ====================== GET BOOKING DETAILS ======================
router.get("/:id", auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("guest", "name email phone profileImage")
      .populate("accommodation", "name type address location")
      .populate("roomType", "name capacity pricePerNight");

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Check if user has access (guest, owner, or admin)
    const isGuest = booking.guest._id.toString() === req.user._id.toString();
    const accommodation = await Accommodation.findById(booking.accommodation._id);
    const isOwner = accommodation.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isGuest && !isOwner && !isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(booking);
  } catch (error) {
    console.error("Get booking error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch booking" });
  }
});

// ====================== CONFIRM BOOKING (HOST/ADMIN) ======================
router.patch("/:id/confirm", auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const accommodation = await Accommodation.findById(booking.accommodation);
    const isOwner = accommodation.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({ error: "Booking can only be confirmed if it's pending" });
    }

    booking.status = "confirmed";
    await booking.save();

    res.json({
      success: true,
      message: "Booking confirmed successfully",
      booking,
    });
  } catch (error) {
    console.error("Confirm booking error:", error);
    res.status(500).json({ error: error.message || "Failed to confirm booking" });
  }
});

// ====================== CANCEL BOOKING ======================
router.patch("/:id/cancel", auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const isGuest = booking.guest.toString() === req.user._id.toString();
    const accommodation = await Accommodation.findById(booking.accommodation);
    const isOwner = accommodation.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isGuest && !isOwner && !isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (booking.status === "cancelled" || booking.status === "completed") {
      return res.status(400).json({ error: "Booking cannot be cancelled" });
    }

    const { cancellationReason } = req.body;

    booking.status = "cancelled";
    booking.cancellationReason = cancellationReason || "";
    booking.cancelledAt = new Date();

    await booking.save();

    // Restore availability
    const checkInDate = new Date(booking.checkIn);
    const checkOutDate = new Date(booking.checkOut);
    const current = new Date(checkInDate);

    while (current < checkOutDate) {
      await Availability.findOneAndUpdate(
        { roomType: booking.roomType, date: current },
        { $inc: { availableUnits: 1 } }
      );
      current.setDate(current.getDate() + 1);
    }

    // Handle refund if payment was made (simplified for now)
    if (booking.paymentStatus === "paid") {
      booking.paymentStatus = "refunded";
      await booking.save();
    }

    res.json({
      success: true,
      message: "Booking cancelled successfully",
      booking,
    });
  } catch (error) {
    console.error("Cancel booking error:", error);
    res.status(500).json({ error: error.message || "Failed to cancel booking" });
  }
});

// ====================== COMPLETE BOOKING (HOST/ADMIN) ======================
router.patch("/:id/complete", auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const accommodation = await Accommodation.findById(booking.accommodation);
    const isOwner = accommodation.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (booking.status !== "confirmed") {
      return res.status(400).json({ error: "Booking can only be completed if it's confirmed" });
    }

    if (new Date(booking.checkOut) > new Date()) {
      return res.status(400).json({ error: "Booking cannot be completed before check-out date" });
    }

    booking.status = "completed";
    await booking.save();

    res.json({
      success: true,
      message: "Booking completed successfully",
      booking,
    });
  } catch (error) {
    console.error("Complete booking error:", error);
    res.status(500).json({ error: error.message || "Failed to complete booking" });
  }
});

// ====================== UPDATE PAYMENT STATUS ======================
router.patch("/:id/payment", auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const isGuest = booking.guest.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isGuest && !isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { paymentStatus } = req.body;
    if (!["pending", "paid", "failed", "refunded"].includes(paymentStatus)) {
      return res.status(400).json({ error: "Invalid payment status" });
    }

    booking.paymentStatus = paymentStatus;

    // Auto-confirm booking when payment is successful
    if (paymentStatus === "paid" && booking.status === "pending") {
      booking.status = "confirmed";
    }

    await booking.save();

    res.json({
      success: true,
      message: "Payment status updated successfully",
      booking,
    });
  } catch (error) {
    console.error("Update payment status error:", error);
    res.status(500).json({ error: error.message || "Failed to update payment status" });
  }
});

export default router;
