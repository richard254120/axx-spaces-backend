import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import accommodationRoutes from "../routes/accommodations.js";
import accommodationBookingRoutes from "../routes/accommodationBookings.js";
import accommodationReviewRoutes from "../routes/accommodationReviews.js";
import Accommodation from "../models/Accommodation.js";
import RoomType from "../models/RoomType.js";
import Availability from "../models/Availability.js";
import Booking from "../models/Booking.js";
import Review from "../models/Review.js";
import User from "../models/User.js";

const app = express();
app.use(express.json());
app.use("/api/accommodations", accommodationRoutes);
app.use("/api/accommodation-bookings", accommodationBookingRoutes);
app.use("/api/accommodation-reviews", accommodationReviewRoutes);

describe("Accommodation API Tests", () => {
  let adminToken, hostToken, guestToken;
  let adminUser, hostUser, guestUser;
  let accommodation, roomType;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI_TEST || process.env.MONGO_URI);

    // Create admin user
    adminUser = await User.create({
      name: "Admin User",
      email: "admin@example.com",
      phone: "+254711111111",
      password: "hashedpassword",
      role: "admin",
    });

    // Create host user
    hostUser = await User.create({
      name: "Host User",
      email: "host@example.com",
      phone: "+254722222222",
      password: "hashedpassword",
      role: "landlord",
    });

    // Create guest user
    guestUser = await User.create({
      name: "Guest User",
      email: "guest@example.com",
      phone: "+254733333333",
      password: "hashedpassword",
      role: "user",
    });

    // Generate mock tokens (in real app, use JWT)
    adminToken = `mock-admin-token-${adminUser._id}`;
    hostToken = `mock-host-token-${hostUser._id}`;
    guestToken = `mock-guest-token-${guestUser._id}`;
  });

  afterAll(async () => {
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Create test accommodation
    accommodation = await Accommodation.create({
      owner: hostUser._id,
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

    // Initialize availability
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
    await Review.deleteMany({});
    await Booking.deleteMany({});
    await Availability.deleteMany({});
    await RoomType.deleteMany({});
    await Accommodation.deleteMany({});
  });

  describe("POST /api/accommodations", () => {
    it("should create a new accommodation as host", async () => {
      const newAccommodation = {
        name: "New Hotel",
        type: "bnb",
        description: "A new bed and breakfast",
        address: "456 New Street",
        lat: -1.286389,
        lng: 36.817223,
        amenities: ["WiFi"],
        houseRules: "No pets",
        checkInTime: "15:00",
        checkOutTime: "10:00",
        maxGuests: 2,
        totalRooms: 5,
      };

      const response = await request(app)
        .post("/api/accommodations")
        .set("Authorization", `Bearer ${hostToken}`)
        .send(newAccommodation)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(newAccommodation.name);
      expect(response.body.data.owner).toBe(hostUser._id.toString());
    });

    it("should fail to create accommodation without authentication", async () => {
      const newAccommodation = {
        name: "New Hotel",
        type: "hotel",
        description: "A test hotel",
      };

      const response = await request(app)
        .post("/api/accommodations")
        .send(newAccommodation)
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /api/accommodations", () => {
    it("should get all active accommodations", async () => {
      const response = await request(app)
        .get("/api/accommodations")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it("should filter accommodations by type", async () => {
      const response = await request(app)
        .get("/api/accommodations?type=hotel")
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(acc => {
        expect(acc.type).toBe("hotel");
      });
    });

    it("should filter accommodations by max guests", async () => {
      const response = await request(app)
        .get("/api/accommodations?maxGuests=4")
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(acc => {
        expect(acc.maxGuests).toBeLessThanOrEqual(4);
      });
    });
  });

  describe("GET /api/accommodations/:id", () => {
    it("should get a single accommodation by ID", async () => {
      const response = await request(app)
        .get(`/api/accommodations/${accommodation._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(accommodation._id.toString());
      expect(response.body.data.name).toBe(accommodation.name);
    });

    it("should return 404 for non-existent accommodation", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/accommodations/${fakeId}`)
        .expect(404);

      expect(response.body.error).toBeDefined();
    });
  });

  describe("PATCH /api/accommodations/:id", () => {
    it("should update accommodation as owner", async () => {
      const updates = {
        name: "Updated Hotel Name",
        description: "Updated description",
      };

      const response = await request(app)
        .patch(`/api/accommodations/${accommodation._id}`)
        .set("Authorization", `Bearer ${hostToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updates.name);
    });

    it("should fail to update accommodation as non-owner", async () => {
      const updates = {
        name: "Unauthorized Update",
      };

      const response = await request(app)
        .patch(`/api/accommodations/${accommodation._id}`)
        .set("Authorization", `Bearer ${guestToken}`)
        .send(updates)
        .expect(403);

      expect(response.body.error).toBeDefined();
    });
  });

  describe("DELETE /api/accommodations/:id", () => {
    it("should delete accommodation as owner", async () => {
      const response = await request(app)
        .delete(`/api/accommodations/${accommodation._id}`)
        .set("Authorization", `Bearer ${hostToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify deletion
      const deleted = await Accommodation.findById(accommodation._id);
      expect(deleted).toBeNull();
    });

    it("should fail to delete accommodation with active bookings", async () => {
      // Create an active booking
      const checkIn = new Date();
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 2);

      await Booking.create({
        guest: guestUser._id,
        accommodation: accommodation._id,
        roomType: roomType._id,
        checkIn: checkIn,
        checkOut: checkOut,
        numberOfGuests: 2,
        totalPrice: 5750,
        status: "confirmed",
      });

      const response = await request(app)
        .delete(`/api/accommodations/${accommodation._id}`)
        .set("Authorization", `Bearer ${hostToken}`)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /api/accommodations/:id/room-types", () => {
    it("should create a room type for accommodation", async () => {
      const newRoomType = {
        name: "Deluxe Room",
        capacity: 3,
        pricePerNight: 8000,
        quantity: 3,
        amenities: ["AC", "TV", "Mini Bar"],
        description: "A deluxe room with extra amenities",
      };

      const response = await request(app)
        .post(`/api/accommodations/${accommodation._id}/room-types`)
        .set("Authorization", `Bearer ${hostToken}`)
        .send(newRoomType)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(newRoomType.name);
    });
  });

  describe("GET /api/accommodation-bookings/check-availability", () => {
    it("should check availability and calculate pricing", async () => {
      const checkIn = new Date();
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 2);

      const response = await request(app)
        .get("/api/accommodation-bookings/check-availability")
        .query({
          accommodationId: accommodation._id,
          roomTypeId: roomType._id,
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          numberOfGuests: 2,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.available).toBe(true);
      expect(response.body.data.totalPrice).toBeGreaterThan(0);
    });

    it("should return unavailable when no units available", async () => {
      const checkIn = new Date();
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 2);

      // Set availability to 0
      await Availability.updateMany(
        { roomType: roomType._id },
        { availableUnits: 0 }
      );

      const response = await request(app)
        .get("/api/accommodation-bookings/check-availability")
        .query({
          accommodationId: accommodation._id,
          roomTypeId: roomType._id,
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          numberOfGuests: 2,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.available).toBe(false);
    });
  });

  describe("POST /api/accommodation-bookings", () => {
    it("should create a new booking", async () => {
      const checkIn = new Date();
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 2);

      const bookingData = {
        accommodationId: accommodation._id,
        roomTypeId: roomType._id,
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        numberOfGuests: 2,
      };

      const response = await request(app)
        .post("/api/accommodation-bookings")
        .set("Authorization", `Bearer ${guestToken}`)
        .send(bookingData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("pending");
    });

    it("should fail to create booking without authentication", async () => {
      const checkIn = new Date();
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 2);

      const bookingData = {
        accommodationId: accommodation._id,
        roomTypeId: roomType._id,
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        numberOfGuests: 2,
      };

      const response = await request(app)
        .post("/api/accommodation-bookings")
        .send(bookingData)
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /api/accommodation-bookings/my-bookings/all", () => {
    it("should get all bookings for authenticated guest", async () => {
      // Create a booking
      const checkIn = new Date();
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 2);

      await Booking.create({
        guest: guestUser._id,
        accommodation: accommodation._id,
        roomType: roomType._id,
        checkIn: checkIn,
        checkOut: checkOut,
        numberOfGuests: 2,
        totalPrice: 5750,
        status: "confirmed",
      });

      const response = await request(app)
        .get("/api/accommodation-bookings/my-bookings/all")
        .set("Authorization", `Bearer ${guestToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe("PATCH /api/accommodation-bookings/:id/cancel", () => {
    it("should cancel a booking as guest", async () => {
      const checkIn = new Date();
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 2);

      const booking = await Booking.create({
        guest: guestUser._id,
        accommodation: accommodation._id,
        roomType: roomType._id,
        checkIn: checkIn,
        checkOut: checkOut,
        numberOfGuests: 2,
        totalPrice: 5750,
        status: "confirmed",
      });

      const response = await request(app)
        .patch(`/api/accommodation-bookings/${booking._id}/cancel`)
        .set("Authorization", `Bearer ${guestToken}`)
        .send({ cancellationReason: "Change of plans" })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("cancelled");
    });
  });

  describe("POST /api/accommodation-reviews", () => {
    it("should create a review for completed booking", async () => {
      // Create a completed booking
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() - 5);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() - 3);

      const booking = await Booking.create({
        guest: guestUser._id,
        accommodation: accommodation._id,
        roomType: roomType._id,
        checkIn: checkIn,
        checkOut: checkOut,
        numberOfGuests: 2,
        totalPrice: 5750,
        status: "completed",
      });

      const reviewData = {
        accommodationId: accommodation._id,
        bookingId: booking._id,
        rating: 5,
        title: "Great stay!",
        comment: "Excellent accommodation and service",
      };

      const response = await request(app)
        .post("/api/accommodation-reviews")
        .set("Authorization", `Bearer ${guestToken}`)
        .send(reviewData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rating).toBe(5);
    });

    it("should fail to create review without completed booking", async () => {
      const reviewData = {
        accommodationId: accommodation._id,
        rating: 5,
        title: "Great stay!",
        comment: "Excellent accommodation",
      };

      const response = await request(app)
        .post("/api/accommodation-reviews")
        .set("Authorization", `Bearer ${guestToken}`)
        .send(reviewData)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /api/accommodation-reviews/accommodation/:accommodationId", () => {
    it("should get reviews for accommodation", async () => {
      // Create a completed booking and review
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() - 5);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() - 3);

      const booking = await Booking.create({
        guest: guestUser._id,
        accommodation: accommodation._id,
        roomType: roomType._id,
        checkIn: checkIn,
        checkOut: checkOut,
        numberOfGuests: 2,
        totalPrice: 5750,
        status: "completed",
      });

      await Review.create({
        accommodation: accommodation._id,
        booking: booking._id,
        user: guestUser._id,
        rating: 5,
        title: "Great stay!",
        comment: "Excellent accommodation",
        status: "approved",
      });

      const response = await request(app)
        .get(`/api/accommodation-reviews/accommodation/${accommodation._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.reviews)).toBe(true);
      expect(response.body.data.averageRating).toBeGreaterThan(0);
    });
  });
});
