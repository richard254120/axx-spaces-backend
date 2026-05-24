import TourismListing from "../models/TourismListing.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { formatTourismCard, formatTourismDetail } from "../utils/tourismFormat.js";

const SORT_MAP = {
  recommended: { isFeatured: -1, createdAt: -1 },
  "price-asc": { price: 1 },
  "price-desc": { price: -1 },
  "rating-desc": { createdAt: -1 },
  "reviews-desc": { createdAt: -1 },
};

function buildListFilter(query) {
  const {
    category,
    county,
    minPrice,
    maxPrice,
    minRating,
    search,
    featured,
  } = query;

  const filter = { status: "approved" };

  if (category && category !== "All") filter.category = category;
  if (county) filter.county = county;
  if (featured === "true") filter.isFeatured = true;

  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = parseFloat(minPrice);
    if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
  }

  if (search) {
    const re = new RegExp(search, "i");
    filter.$or = [{ name: re }, { location: re }, { county: re }, { town: re }];
  }

  return { filter, minRating: minRating ? parseFloat(minRating) : 0 };
}

function sortListings(listings, sortKey, minRating) {
  let result = listings.map(formatTourismCard);

  if (minRating > 0) {
    result = result.filter((p) => p.rating >= minRating);
  }

  switch (sortKey) {
    case "price-asc":
      return result.sort((a, b) => a.price - b.price);
    case "price-desc":
      return result.sort((a, b) => b.price - a.price);
    case "rating-desc":
      return result.sort((a, b) => b.rating - a.rating);
    case "reviews-desc":
      return result.sort((a, b) => b.reviews - a.reviews);
    default:
      return result.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
  }
}

export const getListings = async (req, res) => {
  try {
    const { filter, minRating } = buildListFilter(req.query);
    const sortKey = req.query.sort || "recommended";
    const limit = Math.min(parseInt(req.query.limit) || 100, 200);

    const listings = await TourismListing.find(filter)
      .sort(SORT_MAP[sortKey] || SORT_MAP.recommended)
      .limit(limit);

    res.json({
      success: true,
      count: listings.length,
      data: sortListings(listings, sortKey, minRating),
    });
  } catch (error) {
    console.error("Tourism list error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getFeatured = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 6, 20);
    const listings = await TourismListing.find({ status: "approved", isFeatured: true })
      .sort({ createdAt: -1 })
      .limit(limit);

    let data = listings.map(formatTourismCard);
    if (data.length < limit) {
      const extra = await TourismListing.find({ status: "approved", _id: { $nin: listings.map((l) => l._id) } })
        .sort({ createdAt: -1 })
        .limit(limit - data.length);
      data = [...data, ...extra.map(formatTourismCard)];
    }

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getStats = async (req, res) => {
  try {
    const [total, counties, featured] = await Promise.all([
      TourismListing.countDocuments({ status: "approved" }),
      TourismListing.distinct("county", { status: "approved" }),
      TourismListing.countDocuments({ status: "approved", isFeatured: true }),
    ]);

    const agg = await TourismListing.aggregate([
      { $match: { status: "approved" } },
      { $unwind: "$reviews" },
      { $group: { _id: null, avg: { $avg: "$reviews.rating" } } },
    ]);
    const avgRating = agg[0]?.avg ? Math.round(agg[0].avg * 10) / 10 : 4.8;

    res.json({
      success: true,
      data: {
        propertiesListed: total || 0,
        countiesCovered: counties.length,
        monthlyVisitors: "18K+",
        avgRating: `${avgRating}★`,
        featuredCount: featured,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getCategories = async (req, res) => {
  try {
    const rows = await TourismListing.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const icons = {
      "Beach Resorts": "🏖️",
      "Safari Camps": "🦁",
      "Mountain Lodges": "⛰️",
      "City Hotels": "🏨",
      Camping: "🏕️",
      Adventure: "🗻",
    };

    res.json({
      success: true,
      data: rows.map((r) => ({
        name: r._id,
        count: r.count,
        emoji: icons[r._id] || "🏨",
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getListingById = async (req, res) => {
  try {
    const listing = await TourismListing.findById(req.params.id).populate("owner", "name email phone");
    if (!listing) {
      return res.status(404).json({ success: false, error: "Tourism listing not found" });
    }
    if (listing.status !== "approved" && (!req.user || listing.owner._id.toString() !== req.user._id.toString())) {
      if (req.user?.role !== "admin") {
        return res.status(404).json({ success: false, error: "Tourism listing not found" });
      }
    }

    res.json({ success: true, data: formatTourismDetail(listing) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getMyListings = async (req, res) => {
  try {
    const listings = await TourismListing.find({ owner: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: listings.map(formatTourismCard) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

function parseJsonField(value, fallback = []) {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function buildAndSaveListing(body, user, files = []) {
  const name = body.name?.trim();
  const category = body.category?.trim();
  const description = body.description?.trim();
  const county = body.county?.trim();
  const town = body.town?.trim();
  const basePrice = parseFloat(body.basePrice ?? body.price);

  if (!name || !category || !description || !county || !basePrice) {
    const err = new Error("Missing required fields (name, category, description, county, basePrice)");
    err.status = 400;
    throw err;
  }

  const amenities = parseJsonField(body.amenities);
  if (!amenities.length) {
    const err = new Error("Select at least one amenity");
    err.status = 400;
    throw err;
  }

  const roomTypes = parseJsonField(body.roomTypes);
  const imageUrls = files.length ? files.map((f) => f.path || f.secure_url) : [];

  const packagePrices = { Starter: 2500, Growth: 6000, Premium: 10000 };
  const packageDurations = { Starter: "1 Month", Growth: "3 Months", Premium: "6 Months" };
  const pkgName = body.selectedPackage || "";

  return TourismListing.create({
    name,
    category,
    description,
    location: town ? `${town}, ${county}` : county,
    county,
    town: town || "",
    address: body.address || "",
    mapLink: body.mapLink || "",
    price: basePrice,
    weekendPrice: body.weekendPrice ? parseFloat(body.weekendPrice) : undefined,
    peakPrice: body.peakPrice ? parseFloat(body.peakPrice) : undefined,
    amenities,
    roomTypes: roomTypes
      .filter((r) => r.name && r.price)
      .map((r) => ({
        name: r.name,
        price: parseFloat(r.price),
        guests: parseInt(r.guests) || 2,
        desc: r.desc || "",
      })),
    policies: {
      checkIn: body.checkIn || "14:00",
      checkOut: body.checkOut || "11:00",
      cancellation: body.cancellation || "48",
    },
    bookingUrl: body.bookingUrl || "",
    manager: {
      name: body.managerName || user.name,
      phone: body.phone || user.phone || "",
      email: body.email || user.email,
      whatsapp: body.whatsapp || "",
    },
    advertisingPackage: {
      name: pkgName,
      duration: packageDurations[pkgName] || "",
      price: packagePrices[pkgName] || 0,
    },
    images: imageUrls,
    owner: user._id,
    status: "pending",
  });
}

export const createListing = async (req, res) => {
  try {
    const listing = await buildAndSaveListing(req.body, req.user, req.files || []);
    res.status(201).json({
      success: true,
      message: "Property submitted for review. Our team will contact you within 24 hours.",
      data: formatTourismCard(listing),
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error("Create tourism listing error:", error);
    res.status(status).json({ success: false, error: error.message });
  }
};

/** Register tourism provider + create first listing in one flow */
export const registerProviderListing = async (req, res) => {
  try {
    const { ownerName, ownerEmail, ownerPhone, password } = req.body;

    if (!ownerName || !ownerEmail || !ownerPhone || !password) {
      return res.status(400).json({ success: false, error: "Owner account fields are required" });
    }

    const existing = await User.findOne({ email: ownerEmail.toLowerCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: "Email already registered. Please log in and submit your property.",
      });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: ownerName,
      email: ownerEmail.toLowerCase(),
      phone: ownerPhone,
      password: hashed,
      role: "landlord",
    });

    const listing = await buildAndSaveListing(
      {
        ...req.body,
        managerName: ownerName,
        phone: ownerPhone,
        email: ownerEmail,
      },
      user,
      req.files || []
    );

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({
      success: true,
      message: "Account created and property submitted for review.",
      token,
      user: { id: user._id, name: user.name, email: user.email },
      data: formatTourismCard(listing),
    });
  } catch (error) {
    const status = error.status || 500;
    console.error("Tourism register error:", error);
    res.status(status).json({ success: false, error: error.message });
  }
};

export const addReview = async (req, res) => {
  try {
    const { name, rating, comment } = req.body;
    if (!name || !rating || !comment) {
      return res.status(400).json({ success: false, error: "Name, rating and comment are required" });
    }

    const listing = await TourismListing.findById(req.params.id);
    if (!listing || listing.status !== "approved") {
      return res.status(404).json({ success: false, error: "Listing not found" });
    }

    listing.reviews.push({
      name: name.trim(),
      rating: Number(rating),
      comment: comment.trim(),
      date: new Date().toLocaleDateString("en-KE", { month: "long", year: "numeric" }),
    });
    await listing.save();

    res.status(201).json({ success: true, message: "Review submitted", data: formatTourismDetail(listing) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const incrementView = async (req, res) => {
  try {
    await TourismListing.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to record view" });
  }
};

export const updateListingStatus = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, error: "Admin only" });
    }
    const { status } = req.body;
    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status" });
    }

    const listing = await TourismListing.findByIdAndUpdate(
      req.params.id,
      { status, ...(status === "approved" ? { isFeatured: req.body.isFeatured ?? false } : {}) },
      { new: true }
    );
    if (!listing) return res.status(404).json({ success: false, error: "Not found" });

    res.json({ success: true, data: formatTourismCard(listing) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
