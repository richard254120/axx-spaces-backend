import { chromium, expect } from "@playwright/test";
import mongoose from "mongoose";
import Accommodation from "../models/Accommodation.js";
import RoomType from "../models/RoomType.js";
import Availability from "../models/Availability.js";
import Booking from "../models/Booking.js";
import User from "../models/User.js";

describe("Accommodation Booking E2E Test", () => {
  let browser, context, page;
  let hostUser, guestUser;
  let accommodationId, roomTypeId, bookingId;

  const BASE_URL = process.env.FRONTEND_URL || "http://localhost:5173";
  const API_URL = process.env.API_URL || "http://localhost:5000";

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGO_URI_TEST || process.env.MONGO_URI);

    // Create test users
    hostUser = await User.create({
      name: "Host User",
      email: "host-e2e@example.com",
      phone: "+254744444444",
      password: "hashedpassword",
      role: "landlord",
    });

    guestUser = await User.create({
      name: "Guest User",
      email: "guest-e2e@example.com",
      phone: "+254755555555",
      password: "hashedpassword",
      role: "user",
    });

    // Launch browser
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();
  });

  afterAll(async () => {
    // Clean up test data
    await Booking.deleteMany({});
    await Availability.deleteMany({});
    await RoomType.deleteMany({});
    await Accommodation.deleteMany({});
    await User.deleteMany({ email: { $in: ["host-e2e@example.com", "guest-e2e@example.com"] } });
    await mongoose.connection.close();

    // Close browser
    await context.close();
    await browser.close();
  });

  test("Complete accommodation booking flow: create listing → search → book → cancel", async () => {
    // Step 1: Host logs in and creates accommodation listing
    console.log("Step 1: Host logs in and creates accommodation listing");

    await page.goto(`${BASE_URL}/user-login`);
    
    // Fill in login form
    await page.fill('input[name="email"]', "host-e2e@example.com");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 5000 });

    // Navigate to accommodation host dashboard
    await page.goto(`${BASE_URL}/accommodation/dashboard`);

    // Click "Create New Accommodation" button
    await page.click('button:has-text("Create New Accommodation")');

    // Fill in accommodation form
    await page.fill('input[name="name"]', "E2E Test Hotel");
    await page.selectOption('select[name="type"]', "hotel");
    await page.fill('textarea[name="description"]', "A test hotel for E2E testing");
    await page.fill('input[name="address"]', "789 E2E Test Street");
    await page.fill('input[name="lat"]', "-1.286389");
    await page.fill('input[name="lng"]', "36.817223");
    await page.fill('input[name="maxGuests"]', "4");
    await page.fill('input[name="totalRooms"]', "5");
    await page.fill('input[name="checkInTime"]', "14:00");
    await page.fill('input[name="checkOutTime"]', "11:00");
    await page.fill('textarea[name="houseRules"]', "No smoking, no pets");

    // Submit form
    await page.click('button:has-text("Create Accommodation")');

    // Wait for success message or redirect
    await page.waitForTimeout(2000);

    // Verify accommodation was created in database
    const accommodation = await Accommodation.findOne({ name: "E2E Test Hotel" });
    expect(accommodation).not.toBeNull();
    accommodationId = accommodation._id;
    console.log("✓ Accommodation created successfully:", accommodationId);

    // Step 2: Add room type to the accommodation
    console.log("Step 2: Add room type to the accommodation");

    await page.click('button:has-text("Add Room Type")');

    // Fill in room type form
    await page.fill('input[name="name"]', "E2E Standard Room");
    await page.fill('input[name="capacity"]', "2");
    await page.fill('input[name="pricePerNight"]', "5000");
    await page.fill('input[name="quantity"]', "3");
    await page.fill('textarea[name="description"]', "A standard room for E2E testing");

    // Submit room type form
    await page.click('button:has-text("Add Room Type")');

    await page.waitForTimeout(2000);

    // Verify room type was created in database
    const roomType = await RoomType.findOne({ name: "E2E Standard Room" });
    expect(roomType).not.toBeNull();
    roomTypeId = roomType._id;
    console.log("✓ Room type created successfully:", roomTypeId);

    // Initialize availability for the room type
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      await Availability.create({
        roomType: roomTypeId,
        date: date,
        availableUnits: 3,
        price: 5000,
      });
    }
    console.log("✓ Availability initialized");

    // Step 3: Host logs out
    console.log("Step 3: Host logs out");
    await page.click('button:has-text("Logout")');
    await page.waitForURL(/\/user-login/, { timeout: 5000 });

    // Step 4: Guest logs in
    console.log("Step 4: Guest logs in");

    await page.fill('input[name="email"]', "guest-e2e@example.com");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');

    await page.waitForTimeout(2000);

    // Step 5: Guest searches for accommodations
    console.log("Step 5: Guest searches for accommodations");

    await page.goto(`${BASE_URL}/accommodation-booking-search`);

    // Wait for page to load
    await page.waitForSelector('input[placeholder*="search" i]', { timeout: 5000 });

    // Search for the created accommodation
    await page.fill('input[placeholder*="search" i]', "E2E Test Hotel");
    await page.press('input[placeholder*="search" i]', "Enter");

    await page.waitForTimeout(2000);

    // Verify accommodation appears in search results
    const accommodationCard = page.locator(`text=E2E Test Hotel`);
    await expect(accommodationCard).toBeVisible();
    console.log("✓ Accommodation found in search results");

    // Step 6: Guest views accommodation details
    console.log("Step 6: Guest views accommodation details");

    await page.click(`text=E2E Test Hotel`);
    await page.waitForURL(/\/accommodation-booking-detail/, { timeout: 5000 });

    // Verify accommodation details page loads
    await expect(page.locator('h1:has-text("E2E Test Hotel")')).toBeVisible();
    console.log("✓ Accommodation details page loaded");

    // Step 7: Guest checks availability and selects dates
    console.log("Step 7: Guest checks availability and selects dates");

    // Select check-in date (tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const checkInDate = tomorrow.toISOString().split('T')[0];

    // Select check-out date (day after tomorrow)
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    const checkOutDate = dayAfterTomorrow.toISOString().split('T')[0];

    await page.fill('input[name="checkIn"]', checkInDate);
    await page.fill('input[name="checkOut"]', checkOutDate);
    await page.fill('input[name="numberOfGuests"]', "2");

    // Select room type
    await page.selectOption('select[name="roomTypeId"]', roomTypeId.toString());

    // Click check availability button
    await page.click('button:has-text("Check Availability")');

    await page.waitForTimeout(2000);

    // Verify availability check shows available
    await expect(page.locator('text=Available')).toBeVisible();
    console.log("✓ Availability checked successfully");

    // Step 8: Guest creates booking
    console.log("Step 8: Guest creates booking");

    await page.click('button:has-text("Book Now")');

    await page.waitForTimeout(2000);

    // Verify booking was created in database
    const booking = await Booking.findOne({
      guest: guestUser._id,
      accommodation: accommodationId,
      status: "pending",
    });
    expect(booking).not.toBeNull();
    bookingId = booking._id;
    console.log("✓ Booking created successfully:", bookingId);

    // Step 9: Guest views their bookings
    console.log("Step 9: Guest views their bookings");

    await page.goto(`${BASE_URL}/my-bookings`);

    await page.waitForTimeout(2000);

    // Verify booking appears in guest's bookings
    await expect(page.locator(`text=E2E Test Hotel`)).toBeVisible();
    await expect(page.locator('text=Pending')).toBeVisible();
    console.log("✓ Booking visible in guest dashboard");

    // Step 10: Guest cancels the booking
    console.log("Step 10: Guest cancels the booking");

    await page.click('button:has-text("Cancel Booking")');

    // Fill in cancellation reason
    await page.fill('textarea', "Changed plans");

    // Confirm cancellation
    await page.click('button:has-text("Cancel Booking")');

    await page.waitForTimeout(2000);

    // Verify booking was cancelled in database
    const cancelledBooking = await Booking.findById(bookingId);
    expect(cancelledBooking.status).toBe("cancelled");
    expect(cancelledBooking.cancellationReason).toBe("Changed plans");
    console.log("✓ Booking cancelled successfully");

    // Step 11: Verify availability was restored
    console.log("Step 11: Verify availability was restored");

    const checkInDateObj = new Date(checkInDate);
    const availabilityRecord = await Availability.findOne({
      roomType: roomTypeId,
      date: checkInDateObj,
    });

    expect(availabilityRecord.availableUnits).toBe(3); // Should be restored to original
    console.log("✓ Availability restored after cancellation");

    // Step 12: Guest logs out
    console.log("Step 12: Guest logs out");
    await page.click('button:has-text("Logout")');
    await page.waitForTimeout(1000);

    console.log("\n✅ E2E test completed successfully!");
  });

  test("Admin approves accommodation listing", async () => {
    // Create a pending accommodation
    const pendingAccommodation = await Accommodation.create({
      owner: hostUser._id,
      name: "Pending Test Hotel",
      type: "hotel",
      description: "A test hotel pending approval",
      address: "999 Pending Street",
      location: { lat: -1.286389, lng: 36.817223 },
      amenities: ["WiFi"],
      houseRules: "No smoking",
      checkInTime: "14:00",
      checkOutTime: "11:00",
      maxGuests: 4,
      totalRooms: 5,
      status: "pending_review",
    });

    console.log("Step 1: Admin logs in");

    await page.goto(`${BASE_URL}/user-login`);
    await page.fill('input[name="email"]', "admin@example.com");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');

    await page.waitForTimeout(2000);

    console.log("Step 2: Admin navigates to admin dashboard");

    await page.goto(`${BASE_URL}/admin/dashboard`);

    await page.waitForTimeout(2000);

    console.log("Step 3: Admin clicks on Accommodations tab");

    await page.click('button:has-text("Accommodations")');

    await page.waitForTimeout(2000);

    console.log("Step 4: Admin approves the pending accommodation");

    // Find and click approve button for the pending accommodation
    await page.click(`button:has-text("Approve")`);

    await page.waitForTimeout(2000);

    // Verify accommodation status changed to active
    const approvedAccommodation = await Accommodation.findById(pendingAccommodation._id);
    expect(approvedAccommodation.status).toBe("active");
    console.log("✓ Accommodation approved successfully");

    console.log("Step 5: Admin logs out");
    await page.click('button:has-text("Logout")');
    await page.waitForTimeout(1000);

    // Clean up
    await Accommodation.findByIdAndDelete(pendingAccommodation._id);

    console.log("\n✅ Admin approval test completed successfully!");
  });
});
