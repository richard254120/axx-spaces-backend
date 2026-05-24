/**
 * Seed sample tourism listings for development.
 * Run: node scripts/seedTourism.js
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import TourismListing from "../models/TourismListing.js";
import User from "../models/User.js";

dotenv.config();

const SEED_OWNER = {
  name: "AXX Tourism Demo",
  email: "tourism-demo@axxspace.co.ke",
  phone: "+254700000001",
};

const listings = [
  {
    name: "Serena Beach Resort & Spa",
    location: "Nyali, Mombasa",
    county: "Mombasa",
    town: "Nyali",
    category: "Beach Resort",
    price: 12500,
    color: "#0ea5e9",
    tag: "Top Rated",
    emoji: "🏖️",
    isFeatured: true,
    bookingUrl: "https://www.serenahotels.com/mombasa",
    shortDesc: "Pristine Indian Ocean shores, infinity pools, authentic Swahili hospitality.",
    description:
      "Experience the ultimate coastal getaway at Serena Beach Resort & Spa. Nestled along the pristine shores of Nyali, Mombasa.",
    amenities: ["Pool", "WiFi", "Spa", "Restaurant", "Beach Access"],
    roomTypes: [
      { name: "Standard Garden Room", price: 12500, guests: 2, desc: "Garden view, king bed" },
      { name: "Deluxe Ocean View", price: 18500, guests: 2, desc: "Ocean-facing balcony" },
    ],
    reviews: [
      { name: "Amina K.", rating: 5, date: "March 2026", comment: "Absolutely stunning resort!" },
      { name: "David M.", rating: 5, date: "February 2026", comment: "Best beach resort in Kenya." },
    ],
  },
  {
    name: "Fairmont Mount Kenya Safari Club",
    location: "Nanyuki, Laikipia",
    county: "Laikipia",
    town: "Nanyuki",
    category: "Mountain Lodge",
    price: 28000,
    color: "#22c55e",
    tag: "Luxury",
    emoji: "⛰️",
    isFeatured: true,
    bookingUrl: "https://www.fairmont.com/mount-kenya-safari-club",
    shortDesc: "On the equator at 7,000ft. Colonial elegance, game drives & star gazing.",
    description: "Perched on the equator at 7,000 feet with Mount Kenya views and wildlife experiences.",
    amenities: ["Safari", "Pool", "Restaurant", "WiFi", "Horse Riding"],
    roomTypes: [{ name: "Classic Room", price: 28000, guests: 2, desc: "Mountain view" }],
    reviews: [{ name: "Peter N.", rating: 5, date: "April 2026", comment: "Magical experience." }],
  },
  {
    name: "Nairobi Serena Hotel",
    location: "Nairobi CBD",
    county: "Nairobi",
    town: "CBD",
    category: "City Hotel",
    price: 9500,
    color: "#f59e0b",
    tag: "Most Booked",
    emoji: "🏨",
    isFeatured: true,
    bookingUrl: "https://www.serenahotels.com/nairobi",
    shortDesc: "Heart of Nairobi. Business & leisure, fine dining, rooftop pool.",
    description: "Premium city hotel in the heart of Nairobi CBD.",
    amenities: ["Pool", "WiFi", "Gym", "Restaurant"],
    reviews: [{ name: "Grace A.", rating: 5, date: "March 2026", comment: "Excellent city stay." }],
  },
  {
    name: "Ol Pejeta Bush Camp",
    location: "Laikipia Conservancy",
    county: "Laikipia",
    category: "Safari Camp",
    price: 18000,
    color: "#a855f7",
    tag: "Hidden Gem",
    emoji: "🦁",
    isFeatured: true,
    bookingUrl: "https://www.olpejetabushcamp.com",
    shortDesc: "Home of the last northern white rhinos. Immersive Big Five experience.",
    description: "Intimate bush camp in Ol Pejeta Conservancy with Big Five game drives.",
    amenities: ["Safari", "Meals", "Guide", "WiFi"],
    reviews: [{ name: "James L.", rating: 5, date: "April 2026", comment: "Life-changing conservation experience." }],
  },
  {
    name: "Diani Reef Beach Resort",
    location: "Diani Beach, Kwale",
    county: "Kwale",
    category: "Beach Resort",
    price: 15000,
    color: "#06b6d4",
    emoji: "🤿",
    bookingUrl: "https://www.dianireef.com",
    shortDesc: "Award-winning coral reef, watersports paradise & white sand beaches.",
    description: "Beach resort on Diani's white sands with diving and spa.",
    amenities: ["Beach", "Pool", "Diving", "Spa"],
    reviews: [{ name: "Sarah W.", rating: 4, date: "January 2026", comment: "Great beach getaway." }],
  },
  {
    name: "Hemingways Nairobi",
    location: "Karen, Nairobi",
    county: "Nairobi",
    category: "Boutique Hotel",
    price: 32000,
    color: "#f97316",
    tag: "Premium",
    emoji: "🌿",
    isFeatured: true,
    bookingUrl: "https://www.hemingways-collection.com/nairobi",
    shortDesc: "Karen Blixen country. Award-winning spa, colonial architecture.",
    description: "Boutique luxury in Karen with spa and fine dining.",
    amenities: ["Pool", "Spa", "Restaurant", "Bar"],
    reviews: [{ name: "Maria S.", rating: 5, date: "March 2026", comment: "Exceptional boutique hotel." }],
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  let owner = await User.findOne({ email: SEED_OWNER.email });
  if (!owner) {
    owner = await User.create({
      ...SEED_OWNER,
      password: "seed-only-not-for-login",
      role: "landlord",
    });
    console.log("Created seed owner:", owner.email);
  }

  const existing = await TourismListing.countDocuments({ owner: owner._id });
  if (existing >= listings.length) {
    console.log(`Already seeded (${existing} listings). Skipping.`);
    process.exit(0);
  }

  await TourismListing.deleteMany({ owner: owner._id });

  for (const item of listings) {
    await TourismListing.create({
      ...item,
      owner: owner._id,
      status: "approved",
      policies: { checkIn: "14:00", checkOut: "11:00", cancellation: "48" },
      manager: {
        name: "Reservations Team",
        phone: SEED_OWNER.phone,
        email: SEED_OWNER.email,
      },
    });
    console.log("Seeded:", item.name);
  }

  console.log("Tourism seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
