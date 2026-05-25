import TourismListing from "../models/TourismListing.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { formatTourismCard, formatTourismDetail, formatTourismOwnerDetail } from "../utils/tourismFormat.js";
import { formatUserResponse } from "../utils/formatUser.js";
import { updateUserProfile } from "./profileService.js";

const SORT_MAP = {
  recommended: { isFeatured: -1, createdAt: -1 },
  "price-asc": { price: 1 },
  "price-desc": { price: -1 },
  "rating-desc": { createdAt: -1 },
  "reviews-desc": { createdAt: -1 },
};

const PACKAGE_META = {
  Starter: { duration: "1 Month", price: 2500 },
  Growth: { duration: "3 Months", price: 6000 },
  Premium: { duration: "6 Months", price: 10000 },
};

const CATEGORY_ICONS = {
  "Beach Resort": "🏖️",
  "Safari Camp": "🦁",
  "Mountain Lodge": "⛰️",
  "City Hotel": "🏨",
  "Camping Grounds": "🏕️",
};

function buildListFilter(query) {
  const { category, county, minPrice, maxPrice, search, featured } = query;
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

  return {
    filter,
    minRating: query.minRating ? parseFloat(query.minRating) : 0,
  };
}

function sortListings(listings, sortKey, minRating) {
  let result = listings.map(formatTourismCard);
  if (minRating > 0) result = result.filter((p) => p.rating >= minRating);

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

function parseJsonField(value, fallback = []) {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export async function listListings(query = {}) {
  const { filter, minRating } = buildListFilter(query);
  const sortKey = query.sort || "recommended";
  const limit = Math.min(parseInt(query.limit) || 100, 200);

  const listings = await TourismListing.find(filter)
    .sort(SORT_MAP[sortKey] || SORT_MAP.recommended)
    .limit(limit);

  return {
    count: listings.length,
    items: sortListings(listings, sortKey, minRating),
  };
}

export async function listFeatured(limit = 6) {
  const cap = Math.min(parseInt(limit) || 6, 20);
  const featured = await TourismListing.find({ status: "approved", isFeatured: true })
    .sort({ createdAt: -1 })
    .limit(cap);

  let items = featured.map(formatTourismCard);
  if (items.length < cap) {
    const extra = await TourismListing.find({
      status: "approved",
      _id: { $nin: featured.map((l) => l._id) },
    })
      .sort({ createdAt: -1 })
      .limit(cap - items.length);
    items = [...items, ...extra.map(formatTourismCard)];
  }
  return items;
}

export async function getPlatformStats() {
  const [total, counties, featured, agg] = await Promise.all([
    TourismListing.countDocuments({ status: "approved" }),
    TourismListing.distinct("county", { status: "approved" }),
    TourismListing.countDocuments({ status: "approved", isFeatured: true }),
    TourismListing.aggregate([
      { $match: { status: "approved" } },
      { $unwind: "$reviews" },
      { $group: { _id: null, avg: { $avg: "$reviews.rating" } } },
    ]),
  ]);

  const avgRating = agg[0]?.avg ? Math.round(agg[0].avg * 10) / 10 : 4.8;

  return {
    propertiesListed: total || 0,
    countiesCovered: counties.length,
    monthlyVisitors: "18K+",
    avgRating: `${avgRating}★`,
    featuredCount: featured,
  };
}

export async function listCategories() {
  const rows = await TourismListing.aggregate([
    { $match: { status: "approved" } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return rows.map((r) => ({
    name: r._id,
    count: r.count,
    emoji: CATEGORY_ICONS[r._id] || "🏨",
  }));
}

export async function getListingById(id, viewer = null) {
  const listing = await TourismListing.findById(id).populate("owner", "name email phone");
  if (!listing) {
    const err = new Error("Tourism listing not found");
    err.status = 404;
    throw err;
  }

  const isOwner = viewer && listing.owner?._id?.toString() === viewer._id.toString();
  const isAdmin = viewer?.role === "admin";

  if (listing.status !== "approved" && !isOwner && !isAdmin) {
    const err = new Error("Tourism listing not found");
    err.status = 404;
    throw err;
  }

  return formatTourismDetail(listing);
}

export async function listByOwner(ownerId) {
  const listings = await TourismListing.find({ owner: ownerId }).sort({ createdAt: -1 });
  return listings.map(formatTourismCard);
}

async function getOwnedListingOrThrow(listingId, ownerId) {
  const listing = await TourismListing.findById(listingId);
  if (!listing) {
    const err = new Error("Property not found");
    err.status = 404;
    throw err;
  }
  if (listing.owner.toString() !== ownerId.toString()) {
    const err = new Error("You do not have permission to manage this property");
    err.status = 403;
    throw err;
  }
  return listing;
}

function mediaUrlsFromFiles(files = []) {
  const images = [];
  const videos = [];
  for (const f of files) {
    const url = f.path || f.secure_url;
    if (!url) continue;
    if (f.mimetype?.startsWith("video/")) videos.push(url);
    else images.push(url);
  }
  return { images, videos };
}

export async function updateOwnerProfile(ownerId, body, avatarFile) {
  return updateUserProfile(ownerId, body, avatarFile);
}

export async function getOwnerProfile(ownerId) {
  const user = await User.findById(ownerId).select("name email phone role createdAt");
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  const listings = await TourismListing.find({ owner: ownerId }).sort({ createdAt: -1 });

  return {
    user: formatUserResponse(user),
    stats: {
      total: listings.length,
      pending: listings.filter((l) => l.status === "pending").length,
      approved: listings.filter((l) => l.status === "approved").length,
      rejected: listings.filter((l) => l.status === "rejected").length,
      totalViews: listings.reduce((s, l) => s + (l.views || 0), 0),
    },
    listings: listings.map(formatTourismCard),
  };
}

export async function getOwnerListing(listingId, ownerId) {
  const listing = await getOwnedListingOrThrow(listingId, ownerId);
  return formatTourismOwnerDetail(listing);
}

export async function updateOwnerListing(listingId, ownerId, body, files = []) {
  const listing = await getOwnedListingOrThrow(listingId, ownerId);
  const wasApproved = listing.status === "approved";

  const fields = {
    name: body.name?.trim(),
    category: body.category?.trim(),
    description: body.description?.trim(),
    county: body.county?.trim(),
    town: body.town?.trim(),
    address: body.address,
    mapLink: body.mapLink,
    bookingUrl: body.bookingUrl,
    price: body.basePrice != null ? parseFloat(body.basePrice) : body.price != null ? parseFloat(body.price) : undefined,
    weekendPrice: body.weekendPrice != null && body.weekendPrice !== "" ? parseFloat(body.weekendPrice) : undefined,
    peakPrice: body.peakPrice != null && body.peakPrice !== "" ? parseFloat(body.peakPrice) : undefined,
  };

  Object.entries(fields).forEach(([key, val]) => {
    if (val !== undefined && val !== "") listing[key] = val;
  });

  if (fields.town || fields.county) {
    const town = listing.town || "";
    const county = listing.county || "";
    listing.location = town ? `${town}, ${county}` : county;
  }

  if (body.amenities !== undefined) {
    listing.amenities = parseJsonField(body.amenities);
  }

  if (body.roomTypes !== undefined) {
    const roomTypes = parseJsonField(body.roomTypes);
    listing.roomTypes = roomTypes
      .filter((r) => r.name && r.price)
      .map((r) => ({
        name: r.name,
        price: parseFloat(r.price),
        guests: parseInt(r.guests) || 2,
        desc: r.desc || "",
      }));
  }

  if (body.checkIn || body.checkOut || body.cancellation) {
    listing.policies = {
      ...listing.policies?.toObject?.() || listing.policies,
      ...(body.checkIn && { checkIn: body.checkIn }),
      ...(body.checkOut && { checkOut: body.checkOut }),
      ...(body.cancellation && { cancellation: body.cancellation }),
    };
  }

  if (body.managerName || body.phone || body.email || body.whatsapp) {
    listing.manager = {
      name: body.managerName || listing.manager?.name || "",
      phone: body.phone || listing.manager?.phone || "",
      email: body.email || listing.manager?.email || "",
      whatsapp: body.whatsapp || listing.manager?.whatsapp || "",
    };
  }

  const { images, videos } = mediaUrlsFromFiles(files);
  if (images.length) listing.images = [...(listing.images || []), ...images];
  if (videos.length) listing.videos = [...(listing.videos || []), ...videos];

  let removeImages = [];
  let removeVideos = [];
  try {
    if (body.removeImages) removeImages = parseJsonField(body.removeImages);
    if (body.removeVideos) removeVideos = parseJsonField(body.removeVideos);
  } catch { /* ignore */ }

  if (removeImages.length) {
    listing.images = (listing.images || []).filter((u) => !removeImages.includes(u));
  }
  if (removeVideos.length) {
    listing.videos = (listing.videos || []).filter((u) => !removeVideos.includes(u));
  }

  if (wasApproved) listing.status = "pending";

  await listing.save();
  return formatTourismOwnerDetail(listing);
}

export async function buildAndSaveListing(body, user, files = []) {
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
  const pkgName = body.selectedPackage || "";
  const pkg = PACKAGE_META[pkgName] || { duration: "", price: 0 };

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
    advertisingPackage: { name: pkgName, duration: pkg.duration, price: pkg.price },
    images: imageUrls,
    owner: user._id,
    status: "pending",
  });
}

export async function createListing(body, user, files = []) {
  const listing = await buildAndSaveListing(body, user, files);
  return formatTourismCard(listing);
}

export async function registerProviderAndListing(body, files = []) {
  const { ownerName, ownerEmail, ownerPhone, password } = body;

  if (!ownerName || !ownerEmail || !ownerPhone || !password) {
    const err = new Error("Owner account fields are required");
    err.status = 400;
    throw err;
  }

  const existing = await User.findOne({ email: ownerEmail.toLowerCase() });
  if (existing) {
    const err = new Error("Email already registered. Please log in and submit your property.");
    err.status = 400;
    throw err;
  }

  const user = await User.create({
    name: ownerName,
    email: ownerEmail.toLowerCase(),
    phone: ownerPhone,
    password: await bcrypt.hash(password, 10),
    role: "tourism_provider",
    isApproved: false,
  });

  const listing = await buildAndSaveListing(
    { ...body, managerName: ownerName, phone: ownerPhone, email: ownerEmail },
    user,
    files
  );

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

  return {
    listing: formatTourismCard(listing),
    token,
    user: { id: user._id, name: user.name, email: user.email },
  };
}

export async function addReview(listingId, { name, rating, comment }) {
  if (!name || !rating || !comment) {
    const err = new Error("Name, rating and comment are required");
    err.status = 400;
    throw err;
  }

  const listing = await TourismListing.findById(listingId);
  if (!listing || listing.status !== "approved") {
    const err = new Error("Listing not found");
    err.status = 404;
    throw err;
  }

  listing.reviews.push({
    name: name.trim(),
    rating: Number(rating),
    comment: comment.trim(),
    date: new Date().toLocaleDateString("en-KE", { month: "long", year: "numeric" }),
  });
  await listing.save();
  return formatTourismDetail(listing);
}

export async function recordView(listingId) {
  await TourismListing.findByIdAndUpdate(listingId, { $inc: { views: 1 } });
}

export async function updateStatus(listingId, status, isFeatured = false) {
  if (!["approved", "rejected", "pending"].includes(status)) {
    const err = new Error("Invalid status");
    err.status = 400;
    throw err;
  }

  const listing = await TourismListing.findByIdAndUpdate(
    listingId,
    { status, ...(status === "approved" ? { isFeatured } : {}) },
    { new: true }
  );

  if (!listing) {
    const err = new Error("Listing not found");
    err.status = 404;
    throw err;
  }

  return formatTourismCard(listing);
}
