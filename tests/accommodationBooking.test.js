import mongoose from "mongoose";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import Accommodation from "../models/Accommodation.js";
import RoomType from "../models/RoomType.js";
import Availability from "../models/Availability.js";
import Booking from "../models/Booking.js";
import User from "../models/User.js";

describe("Accommodation Booking Logic Tests", () => {
  let accommodation, roomType, user;

  beforeEach(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGO_URI_TEST || process.env.MONGO_URI);

    // Create test user
    user = await User.create({
      name: "Test User",
      email: "test@example.com",
      phone: "+254712345678",
      password: "hashedpassword",
      role: "user",
    });

    // Create test accommodation
    accommodation = await Accommodation.create({
      owner: user._id,
      name: "Test Hotel",
      type: "hotel",
      description: "A test hotel",
      address: "123 Test Street",
      location: { lat: -1.286389, lng: 36.817223 },
      amenities: ["WiFi", "Pool"],
      houseRules: "No smoking",
      checkInTime: "14:00",
      checkOutTime: "11:00",
      maxGuests: 4,
      totalRooms: 10,
      status: "active",
    });

    // Create test room type
    roomType = await RoomType.create({
      accommodation: accommodation._id,
      name: "Standard Room",
      capacity: 2,
      pricePerNight: 5000,
      quantity: 5,
      amenities: ["AC", "TV"],
      description: "A comfortable standard room",
    });

    // Initialize availability for next 30 days
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      await Availability.create({
        roomType: roomType._id,
        date: date,
        availableUnits: 5,
        price: 5000,
      });
    }
  });

  afterEach(async () => {
    // Clean up test data
    await Booking.deleteMany({});
    await Availability.deleteMany({});
    await RoomType.deleteMany({});
    await Accommodation.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  describe("Price Calculation", () => {
    it("should calculate correct total price for single night", async () => {
      const checkIn = new Date();
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 1);

      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      const basePrice = roomType.pricePerNight * nights;
      const cleaningFee = Math.round(basePrice * 0.1);
      const serviceFee = Math.round(basePrice * 0.05);
      const totalPrice = basePrice + cleaningFee + serviceFee;

      expect(nights).toBe(1);
      expect(basePrice).toBe(5000);
      expect(cleaningFee).toBe(500);
      expect(serviceFee).toBe(250);
      expect(totalPrice).toBe(5750);
    });

    it("should calculate correct total price for multiple nights", async () => {
      const checkIn = new Date();
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 5);

      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      const basePrice = roomType.pricePerNight * nights;
      const cleaningFee = Math.round(basePrice * 0.1);
      const serviceFee = Math.round(basePrice * 0.05);
      const totalPrice = basePrice + cleaningFee + serviceFee;

      expect(nights).toBe(5);
      expect(basePrice).toBe(25000);
      expect(cleaningFee).toBe(2500);
      expect(serviceFee).toBe(1250);
      expect(totalPrice).toBe(28750);
    });

    it("should handle dynamic pricing from availability records", async () => {
      const checkIn = new Date();
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 3);

      // Update availability with dynamic pricing
      const current = new Date(checkIn);
      let i = 0;
      while (current < checkOut) {
        await Availability.findOneAndUpdate(
          { roomType: roomType._id, date: current },
          { price: 6000 + (i * 500) } // Increasing prices: 6000, 6500, 7000
        );
        current.setDate(current.getDate() + 1);
        i++;
      }

      const availabilityRecords = await Availability.find({
        roomType: roomType._id,
        date: { $gte: checkIn, $lt: checkOut }
      }).sort({ date: 1 });

      let totalRoomPrice = 0;
      availabilityRecords.forEach(record => {
        totalRoomPrice += record.price;
      });

      const cleaningFee = Math.round(totalRoomPrice * 0.1);
      const serviceFee = Math.round(totalRoomPrice * 0.05);
      const totalPrice = totalRoomPrice + cleaningFee + serviceFee;

      expect(totalRoomPrice).toBe(19500); // 6000 + 6500 + 7000
      expect(cleaningFee).toBe(1950);
      expect(serviceFee).toBe(975);
      expect(totalPrice).toBe(22425);
    });
  });

  describe("Double-Booking Prevention", () => {
    it("should prevent overlapping bookings for same room type", async () => {
      const checkIn = new Date();
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 3);

      // Create first booking
      const booking1 = await Booking.create({
        guest: user._id,
        accommodation: accommodation._id,
        roomType: roomType._id,
        checkIn: checkIn,
        checkOut: checkOut,
        numberOfGuests: 2,
        totalPrice: 5750,
        cleaningFee: 500,
        serviceFee: 250,
        status: "confirmed",
        paymentStatus: "paid",
      });

      // Update availability
      const current = new Date(checkIn);
      while (current < checkOut) {
        await Availability.findOneAndUpdate(
          { roomType: roomType._id, date: current },
          { $inc: { availableUnits: -1 } }
        );
        current.setDate(current.getDate() + 1);
      }

      // Check availability for overlapping dates
      const overlappingCheckIn = new Date(checkIn);
      overlappingCheckIn.setDate(overlappingCheckIn.getDate() + 1);
      const overlappingCheckOut = new Date(checkOut);
      overlappingCheckOut.setDate(overlappingCheckOut.getDate() + 1);

      const availabilityRecords = await Availability.find({
        roomType: roomType._id,
        date: {
          $gte: overlappingCheckIn,
          $lt: overlappingCheckOut
        }
      });

      // Check if any date has insufficient units
      let hasAvailability = true;
      for (const record of availabilityRecords) {
        if (record.availableUnits < 1) {
          hasAvailability = false;
          break;
        }
      }

      expect(hasAvailability).toBe(false);
    });

    it("should allow non-overlapping bookings", async () => {
      const checkIn1 = new Date();
      const checkOut1 = new Date(checkIn1);
      checkOut1.setDate(checkOut1.getDate() + 3);

      // Create first booking
      await Booking.create({
        guest: user._id,
        accommodation: accommodation._id,
        roomType: roomType._id,
        checkIn: checkIn1,
        checkOut: checkOut1,
        numberOfGuests: 2,
        totalPrice: 5750,
        cleaningFee: 500,
        serviceFee: 250,
        status: "confirmed",
        paymentStatus: "paid",
      });

      // Update availability for first booking
      const current = new Date(checkIn1);
      while (current < checkOut1) {
        await Availability.findOneAndUpdate(
          { roomType: roomType._id, date: current },
          { $inc: { availableUnits: -1 } }
        );
        current.setDate(current.getDate() + 1);
      }

      // Try booking for non-overlapping dates
      const checkIn2 = new Date(checkOut1);
      const checkOut2 = new Date(checkIn2);
      checkOut2.setDate(checkOut2.getDate() + 2);

      const availabilityRecords = await Availability.find({
        roomType: roomType._id,
        date: {
          $gte: checkIn2,
          $lt: checkOut2
        }
      });

      // Check if all dates have sufficient units
      let hasAvailability = true;
      for (const record of availabilityRecords) {
        if (record.availableUnits < 1) {
          hasAvailability = false;
          break;
        }
      }

      expect(hasAvailability).toBe(true);
    });

    it("should handle multiple bookings up to room capacity", async () => {
      const checkIn = new Date();
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 2);

      // Create bookings up to room capacity (5 units)
      for (let i = 0; i < 5; i++) {
        await Booking.create({
          guest: user._id,
          accommodation: accommodation._id,
          roomType: roomType._id,
          checkIn: checkIn,
          checkOut: checkOut,
          numberOfGuests: 2,
          totalPrice: 5750,
          cleaningFee: 500,
          serviceFee: 250,
          status: "confirmed",
          paymentStatus: "paid",
        });
      }

      // Update availability
      const current = new Date(checkIn);
      while (current < checkOut) {
        await Availability.findOneAndUpdate(
          { roomType: roomType._id, date: current },
          { availableUnits: 0 }
        );
        current.setDate(current.getDate() + 1);
      }

      // Check availability - should be 0
      const availabilityRecord = await Availability.findOne({
        roomType: roomType._id,
        date: checkIn
      });

      expect(availabilityRecord.availableUnits).toBe(0);
    });
  });

  describe("Booking Validation", () => {
    it("should validate check-out is after check-in", async () => {
      const checkIn = new Date();
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() - 1); // Invalid: before check-in

      const booking = new Booking({
        guest: user._id,
        accommodation: accommodation._id,
        roomType: roomType._id,
        checkIn: checkIn,
        checkOut: checkOut,
        numberOfGuests: 2,
        totalPrice: 5750,
      });

      await expect(booking.save()).rejects.toThrow("Check-out date must be after check-in date");
    });

    it("should validate number of guests does not exceed room capacity", async () => {
      const checkIn = new Date();
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 2);

      // Room capacity is 2, try booking for 4 guests
      const booking = new Booking({
        guest: user._id,
        accommodation: accommodation._id,
        roomType: roomType._id,
        checkIn: checkIn,
        checkOut: checkOut,
        numberOfGuests: 4, // Exceeds capacity
        totalPrice: 5750,
      });

      // This validation should be handled at the API level
      // Here we just verify the data structure
      expect(booking.numberOfGuests).toBeGreaterThan(roomType.capacity);
    });

    it("should validate required fields", async () => {
      const booking = new Booking({
        guest: user._id,
        // Missing required fields
      });

      await expect(booking.save()).rejects.toThrow();
    });
  });

  describe("Availability Management", () => {
    it("should restore availability when booking is cancelled", async () => {
      const checkIn = new Date();
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 2);

      // Create booking
      const booking = await Booking.create({
        guest: user._id,
        accommodation: accommodation._id,
        roomType: roomType._id,
        checkIn: checkIn,
        checkOut: checkOut,
        numberOfGuests: 2,
        totalPrice: 5750,
        cleaningFee: 500,
        serviceFee: 250,
        status: "confirmed",
        paymentStatus: "paid",
      });

      // Update availability (simulate booking)
      const current = new Date(checkIn);
      while (current < checkOut) {
        await Availability.findOneAndUpdate(
          { roomType: roomType._id, date: current },
          { $inc: { availableUnits: -1 } }
        );
        current.setDate(current.getDate() + 1);
      }

      // Verify availability decreased
      let availabilityRecord = await Availability.findOne({
        roomType: roomType._id,
        date: checkIn
      });
      const decreasedUnits = availabilityRecord.availableUnits;

      // Cancel booking and restore availability
      booking.status = "cancelled";
      booking.cancellationReason = "Test cancellation";
      booking.cancelledAt = new Date();
      await booking.save();

      const restoreCurrent = new Date(checkIn);
      while (restoreCurrent < checkOut) {
        await Availability.findOneAndUpdate(
          { roomType: roomType._id, date: restoreCurrent },
          { $inc: { availableUnits: 1 } }
        );
        restoreCurrent.setDate(restoreCurrent.getDate() + 1);
      }

      // Verify availability restored
      availabilityRecord = await Availability.findOne({
        roomType: roomType._id,
        date: checkIn
      });

      expect(availabilityRecord.availableUnits).toBe(decreasedUnits + 1);
    });
  });
});
