import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { spawn } from "node:child_process";
import fs from "fs";
import axxgoRoutes from "../routes/axxgo.js";
import AxxGoListing from "../models/AxxGoListing.js";
import AxxGoReport from "../models/AxxGoReport.js";
import User from "../models/User.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/axxjunks", axxgoRoutes);
app.use("/api/axxgo", axxgoRoutes);

let server;
let baseUrl;
let mongodProc;
let testUser;
let testUserId;
let authToken;
let guestToken;

describe("AxxJunks Classifieds Backend API Tests", () => {
  let createdListingId;
  let createdManageToken;

  before(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "axxspace_test_jwt_secret_key_12345";
    const testDbDir = "/tmp/axxgo_test_db";
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }

    mongodProc = spawn("mongod", [
      "--dbpath",
      testDbDir,
      "--port",
      "27019",
      "--bind_ip",
      "127.0.0.1",
    ]);

    // Wait for mongod "Waiting for connections" signal
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => resolve(), 3000);
      mongodProc.stdout.on("data", (data) => {
        if (data.toString().includes("Waiting for connections")) {
          clearTimeout(timeout);
          resolve();
        }
      });
      mongodProc.on("error", reject);
    });

    // Connect Mongoose to local standalone instance
    await mongoose.connect("mongodb://127.0.0.1:27019/axxgo_test?directConnection=true", {
      serverSelectionTimeoutMS: 5000,
    });

    // Create a registered AxxSpace test user
    await User.deleteMany({ email: { $in: ["john.registered@axxspace.com", "guest.test@axxspace.com"] } });
    testUser = await User.create({
      name: "John Registered",
      email: "john.registered@axxspace.com",
      password: "password123",
      phone: "0712345678",
      role: "member",
    });
    testUserId = testUser._id.toString();

    authToken = jwt.sign(
      { userId: testUserId, role: "member" },
      process.env.JWT_SECRET,
      { algorithm: "HS256" }
    );

    // Create a guest user (unregistered)
    const guestUser = await User.create({
      name: "Guest Explorer",
      email: "guest.test@axxspace.com",
      password: "password123",
      phone: "0700000000",
      role: "guest",
    });
    guestToken = jwt.sign(
      { userId: guestUser._id.toString(), role: "guest" },
      process.env.JWT_SECRET,
      { algorithm: "HS256" }
    );

    // Start Express test server
    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api/axxjunks`;
        resolve();
      });
    });
  });

  after(async () => {
    if (createdListingId) {
      await AxxGoListing.findByIdAndDelete(createdListingId).catch(() => {});
      await AxxGoReport.deleteMany({ listing: createdListingId }).catch(() => {});
    }
    if (testUserId) {
      await User.findByIdAndDelete(testUserId).catch(() => {});
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }
    if (mongodProc) {
      mongodProc.kill("SIGTERM");
    }
  });

  test("1. Reject posting if no authorization token provided (401)", async () => {
    const res = await fetch(`${baseUrl}/listings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "Quick Sales",
        title: "Unauthorized Post",
        description: "Should fail because no token provided.",
        county: "Nairobi",
        area: "CBD",
        posterName: "Anonymous",
        posterPhone: "0712345678",
        photos: ["https://res.cloudinary.com/demo/image/upload/sample.jpg"],
      }),
    });

    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.match(data.error, /access denied|no token/i);
  });

  test("2. Reject posting if user has guest role (403)", async () => {
    const res = await fetch(`${baseUrl}/listings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${guestToken}`,
      },
      body: JSON.stringify({
        category: "Quick Sales",
        title: "Guest Post Attempt",
        description: "Should fail because user is only a guest.",
        county: "Nairobi",
        area: "CBD",
        posterName: "Guest",
        posterPhone: "0712345678",
        photos: ["https://res.cloudinary.com/demo/image/upload/sample.jpg"],
      }),
    });

    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.match(data.error, /community member|explorer|only axxspace/i);
  });

  test("2b. Reject posting if user has a non-member registered role (e.g. landlord)", async () => {
    const landlordUser = await User.create({
      name: "Landlord Test",
      email: "landlord.test@axxspace.com",
      password: "password123",
      phone: "0788888888",
      role: "landlord",
    });
    const landlordToken = jwt.sign(
      { userId: landlordUser._id.toString(), role: "landlord" },
      process.env.JWT_SECRET,
      { algorithm: "HS256" }
    );

    const res = await fetch(`${baseUrl}/listings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${landlordToken}`,
      },
      body: JSON.stringify({
        category: "Rentals",
        title: "Landlord Property Post",
        description: "Should be blocked — only member/user roles can post.",
        county: "Nairobi City",
        area: "Westlands",
        posterName: "Landlord",
        posterPhone: "0788888888",
        photos: ["https://res.cloudinary.com/demo/image/upload/sample.jpg"],
      }),
    });

    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.match(data.error, /community member|explorer|only axxspace/i);

    await User.findByIdAndDelete(landlordUser._id).catch(() => {});
  });

  test("3. Reject posting if honeypot 'website_hp' is filled (anti-bot)", async () => {
    const res = await fetch(`${baseUrl}/listings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        website_hp: "bot-payload",
        category: "Rentals",
        title: "Bot Posting Rental",
        description: "This should be blocked by honeypot.",
        county: "Nairobi",
        area: "Westlands",
        posterName: "Spam Bot",
        posterPhone: "0712345678",
        photos: ["https://res.cloudinary.com/demo/image/upload/sample.jpg"],
      }),
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /spam/i);
  });

  test("4. Reject posting with banned scam phrases", async () => {
    const res = await fetch(`${baseUrl}/listings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        category: "Rentals",
        title: "Cheap Apartment Send Money First",
        description: "Send money before viewing to reserve your spot.",
        county: "Nairobi",
        area: "Kilimani",
        posterName: "Scammer",
        posterPhone: "0799999999",
        photos: ["https://res.cloudinary.com/demo/image/upload/sample.jpg"],
      }),
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /restricted|flagged/i);
  });

  test("5. Successfully post a listing as a registered AxxSpace user", async () => {
    const payload = {
      category: "Quick Sales",
      title: "Apple iPhone 13 128GB Midnight",
      description: "Mint condition iPhone 13 with charger and cover. Battery health 89%.",
      price: 52000,
      priceType: "negotiable",
      pricePeriod: "one-off",
      county: "Nairobi City",
      area: "CBD Kimathi Street",
      posterName: "John Registered",
      posterPhone: "0712345678",
      posterWhatsapp: "0712345678",
      posterEmail: "john.registered@axxspace.com",
      photos: ["https://res.cloudinary.com/demo/image/upload/sample.jpg"],
      categoryFields: {
        itemCondition: "used - like new",
        brand: "Apple",
        reasonForSelling: "Upgraded to iPhone 15",
      },
    };

    const res = await fetch(`${baseUrl}/listings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.listing);
    assert.strictEqual(data.listing.status, "active"); // LIVE IMMEDIATELY!
    assert.strictEqual(data.listing.user, testUserId); // Attached to registered user!
    assert.ok(data.manageToken);
    assert.ok(data.manageUrl);
    assert.match(data.message, /AxxJunks/i);

    createdListingId = data.listing._id;
    createdManageToken = data.manageToken;
  });

  test("6. Retrieve user's published listings (/my-listings)", async () => {
    const res = await fetch(`${baseUrl}/my-listings`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.listings));
    const found = data.listings.find((l) => l._id === createdListingId);
    assert.ok(found, "User should be able to view his published things");
  });

  test("7. Browse listings and find the created post (Public)", async () => {
    const res = await fetch(`${baseUrl}/listings?category=Quick%20Sales&search=iPhone`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.listings));
    const found = data.listings.find((l) => l._id === createdListingId);
    assert.ok(found, "Created listing should appear in browse results");
    assert.strictEqual(found.manageToken, undefined, "manageToken must not be leaked in public API");
  });

  test("8. View single listing by ID (Public)", async () => {
    const res = await fetch(`${baseUrl}/listings/${createdListingId}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.listing._id, createdListingId);
    assert.strictEqual(data.listing.manageToken, undefined, "manageToken must not be leaked in public API");
  });

  test("9. Manage listing using secret token - update status to 'sold'", async () => {
    // Retrieve listing with manage token
    const getRes = await fetch(`${baseUrl}/manage/${createdManageToken}`);
    assert.strictEqual(getRes.status, 200);
    const getData = await getRes.json();
    assert.strictEqual(getData.listing._id, createdListingId);

    // Update status to 'sold'
    const updateRes = await fetch(`${baseUrl}/manage/${createdManageToken}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "sold",
        price: 50000,
      }),
    });
    assert.strictEqual(updateRes.status, 200);
    const updateData = await updateRes.json();
    assert.strictEqual(updateData.listing.status, "sold");
    assert.strictEqual(updateData.listing.price, 50000);

    // Revert to active for remaining tests
    await fetch(`${baseUrl}/manage/${createdManageToken}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
  });

  test("10. Renew listing by manage token (extends 30 days)", async () => {
    const renewRes = await fetch(`${baseUrl}/manage/${createdManageToken}/renew`, {
      method: "POST",
    });
    assert.strictEqual(renewRes.status, 200);
    const renewData = await renewRes.json();
    assert.strictEqual(renewData.success, true);
    assert.ok(new Date(renewData.expiresAt).getTime() > Date.now());
  });

  test("11. Reporting mechanism and auto-hide at 3 reports", async () => {
    // Report 1
    const r1 = await fetch(`${baseUrl}/listings/${createdListingId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "scam", details: "Suspicious seller" }),
    });
    assert.strictEqual(r1.status, 200);
    const r1Data = await r1.json();
    assert.strictEqual(r1Data.autoHidden, false);

    // Report 2
    const r2 = await fetch(`${baseUrl}/listings/${createdListingId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "offensive", details: "Bad language" }),
    });
    assert.strictEqual(r2.status, 200);
    const r2Data = await r2.json();
    assert.strictEqual(r2Data.autoHidden, false);

    // Report 3 (Threshold reached: AUTO-HIDE!)
    const r3 = await fetch(`${baseUrl}/listings/${createdListingId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "scam", details: "Third report" }),
    });
    assert.strictEqual(r3.status, 200);
    const r3Data = await r3.json();
    assert.strictEqual(r3Data.autoHidden, true);

    // Verify it is now hidden from public search
    const searchRes = await fetch(`${baseUrl}/listings?search=iPhone`);
    const searchData = await searchRes.json();
    const hiddenFound = searchData.listings.find((l) => l._id === createdListingId);
    assert.strictEqual(hiddenFound, undefined, "Listing should be hidden from browse results after 3 reports");

    // Verify detail returns 410 Gone / hidden notice
    const detailRes = await fetch(`${baseUrl}/listings/${createdListingId}`);
    assert.strictEqual(detailRes.status, 410);
  });

  test("12. Delete listing using secret manage token", async () => {
    const delRes = await fetch(`${baseUrl}/manage/${createdManageToken}`, {
      method: "DELETE",
    });
    assert.strictEqual(delRes.status, 200);
    const delData = await delRes.json();
    assert.strictEqual(delData.success, true);

    // Verify it is gone
    const checkRes = await fetch(`${baseUrl}/manage/${createdManageToken}`);
    assert.strictEqual(checkRes.status, 404);
    createdListingId = null;
  });
});
