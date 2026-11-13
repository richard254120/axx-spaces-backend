import crypto from "crypto";
import axios from "axios";
import AxxGoListing from "../models/AxxGoListing.js";
import AxxGoReport from "../models/AxxGoReport.js";
import AxxGoBanned from "../models/AxxGoBanned.js";
import { processAndStoreAxxGoImages } from "../utils/axxgoImageProcessor.js";
import { sendAxxGoManageEmail } from "../utils/axxgoEmail.js";

// Common banned words / spam phrases
const BANNED_WORDS = [
  "send money before viewing",
  "pay deposit before viewing",
  "reservation fee upfront",
  "send mpesa before viewing",
  "send m-pesa first",
  "western union",
  "wire transfer",
  "hack account",
  "counterfeit money",
  "fake currency",
  "bitcoin doubler",
  "crypto doubler",
  "loan scam",
  "illuminati",
];

/**
 * Text sanitization helper
 */
function sanitizeString(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/[<>]/g, "")
    .trim();
}

/**
 * Check if text contains any banned spam words
 */
function containsBannedWords(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return BANNED_WORDS.some((word) => lower.includes(word));
}

/**
 * Normalize Kenyan phone number for consistent storage and matching
 */
function normalizePhone(phone) {
  if (!phone) return "";
  let clean = phone.replace(/[^0-9+]/g, "").trim();
  if (clean.startsWith("0")) {
    clean = "+254" + clean.substring(1);
  } else if (clean.startsWith("254")) {
    clean = "+" + clean;
  }
  return clean;
}

/**
 * Optional Captcha verification (e.g. Cloudflare Turnstile or Google reCAPTCHA)
 */
async function verifyCaptcha(token, remoteIp) {
  if (!token) return true; // If captcha token not passed and not strictly enforced, allow (or validate challenge)

  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    try {
      const resp = await axios.post(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        new URLSearchParams({
          secret: turnstileSecret,
          response: token,
          remoteip: remoteIp,
        })
      );
      return resp.data && resp.data.success;
    } catch (err) {
      console.warn("Turnstile verification error:", err.message);
      return true;
    }
  }

  const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
  if (recaptchaSecret) {
    try {
      const resp = await axios.post(
        "https://www.google.com/recaptcha/api/siteverify",
        new URLSearchParams({
          secret: recaptchaSecret,
          response: token,
          remoteip: remoteIp,
        })
      );
      return resp.data && resp.data.success;
    } catch (err) {
      console.warn("reCAPTCHA verification error:", err.message);
      return true;
    }
  }

  return true;
}

// ====================== 1. CREATE LISTING (LIVE IMMEDIATELY) ======================
export async function createListing(req, res) {
  try {
    const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "";

    // Honeypot check: hidden field 'website_hp' must remain empty
    if (req.body.website_hp) {
      console.warn(`[AxxJunks] Honeypot triggered from IP ${clientIp}`);
      return res.status(400).json({ error: "Spam detected. Submission rejected." });
    }

    // Restrict posting: only registered AxxSpace users (not guests or anonymous)
    if (!req.user || req.user.role === "guest") {
      return res.status(403).json({
        error: "Only registered AxxSpace users can post on AxxJunks. Please sign in or register to publish your listing.",
      });
    }

    // Bot challenge verification if provided
    if (req.body.captchaToken) {
      const isValidCaptcha = await verifyCaptcha(req.body.captchaToken, clientIp);
      if (!isValidCaptcha) {
        return res.status(400).json({ error: "Captcha verification failed. Please try again." });
      }
    }

    // Parse payload
    let {
      category,
      title,
      description,
      price,
      priceType,
      pricePeriod,
      county,
      area,
      posterName,
      posterPhone,
      posterWhatsapp,
      posterEmail,
      categoryFields,
    } = req.body;

    // Sanitize strings & fallback to authenticated user profile
    title = sanitizeString(title);
    description = sanitizeString(description);
    county = sanitizeString(county);
    area = sanitizeString(area);
    posterName = sanitizeString(posterName) || sanitizeString(req.user.name || "");
    const cleanPhone = normalizePhone(posterPhone) || normalizePhone(req.user.phone || "");
    const cleanWhatsapp = posterWhatsapp ? normalizePhone(posterWhatsapp) : "";
    const cleanEmail = posterEmail
      ? sanitizeString(posterEmail).toLowerCase()
      : sanitizeString(req.user.email || "").toLowerCase();

    // Parse categoryFields if stringified (from multipart/form-data)
    let parsedCategoryFields = {};
    if (typeof categoryFields === "string") {
      try {
        parsedCategoryFields = JSON.parse(categoryFields);
      } catch (e) {
        parsedCategoryFields = {};
      }
    } else if (categoryFields && typeof categoryFields === "object") {
      parsedCategoryFields = { ...categoryFields };
    }

    // Validation
    if (!category || !["Rentals", "Accommodation", "AxxBiashara", "Quick Sales"].includes(category)) {
      return res.status(400).json({ error: "Valid category is required." });
    }
    if (!title || title.length < 3) {
      return res.status(400).json({ error: "Title is required (minimum 3 characters)." });
    }
    if (!description || description.length < 10) {
      return res.status(400).json({ error: "Description is required (minimum 10 characters)." });
    }
    if (!county || !area) {
      return res.status(400).json({ error: "Location county and specific area are required." });
    }
    if (!posterName || !cleanPhone) {
      return res.status(400).json({ error: "Poster name and phone number are required." });
    }

    // Check banned entities (Phone or IP)
    const isBanned = await AxxGoBanned.findOne({
      $or: [
        { type: "phone", value: cleanPhone.toLowerCase() },
        { type: "ip", value: clientIp.toLowerCase() },
      ],
    });
    if (isBanned) {
      return res.status(403).json({
        error: "Your phone number or IP has been banned from posting on AxxGo due to policy violations.",
      });
    }

    // Check banned words
    const combinedText = `${title} ${description} ${parsedCategoryFields.businessName || ""}`;
    if (containsBannedWords(combinedText)) {
      return res.status(400).json({
        error:
          "Your listing contains restricted or flagged phrases (e.g. asking for upfront payment or suspicious terms). Please revise your text.",
      });
    }

    // Duplicate detection: same phone and title within 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const existingDuplicate = await AxxGoListing.findOne({
      "poster.phone": cleanPhone,
      title: { $regex: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      createdAt: { $gte: tenMinutesAgo },
    });
    if (existingDuplicate) {
      return res.status(429).json({
        error: "A listing with this exact title was posted recently. Please avoid duplicate posts.",
      });
    }

    // Handle photos: process uploaded files with Sharp (max 8, min 1)
    let photoUrls = [];
    if (req.files && req.files.length > 0) {
      photoUrls = await processAndStoreAxxGoImages(req.files);
    } else if (req.body.photos && Array.isArray(req.body.photos)) {
      photoUrls = req.body.photos.filter((p) => typeof p === "string" && p.startsWith("http"));
    }

    if (photoUrls.length === 0) {
      return res.status(400).json({ error: "At least one photo is required." });
    }

    // Generate unique secure management token for account-free edit/delete
    const manageToken = crypto.randomBytes(24).toString("hex");

    // Create listing - status is "active" (LIVE IMMEDIATELY for registered AxxSpace users)
    const newListing = await AxxGoListing.create({
      category,
      title,
      description,
      price: Number(price) >= 0 ? Number(price) : 0,
      priceType: ["fixed", "negotiable", "contact_for_price"].includes(priceType) ? priceType : "fixed",
      pricePeriod: ["one-off", "per-month", "per-night"].includes(pricePeriod) ? pricePeriod : "one-off",
      location: {
        county,
        area,
      },
      photos: photoUrls,
      user: req.user._id,
      poster: {
        name: posterName,
        phone: cleanPhone,
        whatsapp: cleanWhatsapp,
        email: cleanEmail,
      },
      categoryFields: parsedCategoryFields,
      status: "active",
      manageToken,
      ip: clientIp,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    // Send management link via email if provided
    if (cleanEmail) {
      sendAxxGoManageEmail({
        toEmail: cleanEmail,
        posterName,
        title,
        listingId: newListing._id,
        manageToken,
      }).catch((e) => console.warn("AxxJunks email error:", e.message));
    }

    const frontendBase =
      process.env.FRONTEND_URL ||
      (process.env.NODE_ENV === "production" ? "https://axxspace.com" : "http://localhost:5173");

    return res.status(201).json({
      success: true,
      message: "Listing published successfully! It is now live on AxxJunks.",
      listing: newListing,
      manageToken,
      manageUrl: `${frontendBase}/axxjunks/manage/${manageToken}`,
      listingUrl: `${frontendBase}/axxjunks/listing/${newListing._id}`,
    });
  } catch (error) {
    console.error("Create AxxJunks listing error:", error);
    return res.status(500).json({ error: error.message || "Failed to create listing." });
  }
}

// ====================== 2. GET LISTINGS (BROWSE & SEARCH) ======================
export async function getListings(req, res) {
  try {
    const {
      category,
      county,
      area,
      minPrice,
      maxPrice,
      search,
      sort = "newest",
      page = 1,
      limit = 20,
    } = req.query;

    const query = {
      status: "active",
      reportCount: { $lt: 3 }, // Auto-hide if reported 3+ times
      expiresAt: { $gt: new Date() }, // Only non-expired
    };

    if (category && ["Rentals", "Accommodation", "AxxBiashara", "Quick Sales"].includes(category)) {
      query.category = category;
    }

    if (county && county !== "All") {
      query["location.county"] = new RegExp(`^${county.trim()}$`, "i");
    }

    if (area && area.trim()) {
      query["location.area"] = new RegExp(area.trim(), "i");
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice && !isNaN(Number(minPrice))) query.price.$gte = Number(minPrice);
      if (maxPrice && !isNaN(Number(maxPrice))) query.price.$lte = Number(maxPrice);
    }

    // Keyword search across title, description, and location
    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { title: new RegExp(term, "i") },
        { description: new RegExp(term, "i") },
        { "location.area": new RegExp(term, "i") },
        { "categoryFields.businessName": new RegExp(term, "i") },
      ];
    }

    // Sorting
    let sortOptions = { createdAt: -1 }; // newest first by default
    if (sort === "price_asc") sortOptions = { price: 1, createdAt: -1 };
    if (sort === "price_desc") sortOptions = { price: -1, createdAt: -1 };
    if (sort === "popular") sortOptions = { views: -1, createdAt: -1 };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [listings, total] = await Promise.all([
      AxxGoListing.find(query)
        .select("-manageToken -ip") // Keep management token secret
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AxxGoListing.countDocuments(query),
    ]);

    return res.json({
      success: true,
      listings,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Get AxxGo listings error:", error);
    return res.status(500).json({ error: "Failed to fetch listings." });
  }
}

// ====================== 3. GET SINGLE LISTING BY ID ======================
export async function getListingById(req, res) {
  try {
    const { id } = req.params;
    const listing = await AxxGoListing.findById(id).select("-manageToken -ip");

    if (!listing) {
      return res.status(404).json({ error: "Listing not found." });
    }

    // If auto-hidden due to reports and not requested by admin
    if (listing.reportCount >= 3 || listing.status === "hidden") {
      return res.status(410).json({ error: "This listing has been hidden due to community reports." });
    }

    // Asynchronously increment views
    AxxGoListing.findByIdAndUpdate(id, { $inc: { views: 1 } }).exec();

    return res.json({ success: true, listing });
  } catch (error) {
    console.error("Get AxxGo listing by ID error:", error);
    return res.status(500).json({ error: "Failed to fetch listing." });
  }
}

// ====================== 4. REPORT A LISTING (AUTO-HIDE AT 3+ REPORTS) ======================
export async function reportListing(req, res) {
  try {
    const { id } = req.params;
    const { reason, details, reporterContact } = req.body;
    const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "";

    if (!reason || !["scam", "wrong_category", "offensive", "sold", "other"].includes(reason)) {
      return res.status(400).json({ error: "A valid report reason is required." });
    }

    const listing = await AxxGoListing.findById(id);
    if (!listing) {
      return res.status(404).json({ error: "Listing not found." });
    }

    // Create report record
    await AxxGoReport.create({
      listing: id,
      reason,
      details: sanitizeString(details || ""),
      reporterContact: sanitizeString(reporterContact || ""),
      ip: clientIp,
    });

    // Increment listing report count
    listing.reportCount = (listing.reportCount || 0) + 1;

    // Auto-hide if reaches 3 or more reports
    if (listing.reportCount >= 3) {
      listing.status = "hidden";
      console.log(`[AxxGo] Listing ${id} auto-hidden after ${listing.reportCount} reports.`);
    }

    await listing.save();

    return res.json({
      success: true,
      message: "Thank you for helping keep AxxGo safe. Your report has been submitted.",
      autoHidden: listing.reportCount >= 3,
    });
  } catch (error) {
    console.error("Report AxxGo listing error:", error);
    return res.status(500).json({ error: "Failed to submit report." });
  }
}

// ====================== 5. MANAGE LISTING BY SECRET TOKEN (NO LOGIN) ======================
export async function getListingByManageToken(req, res) {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ error: "Manage token is required." });

    const listing = await AxxGoListing.findOne({ manageToken: token });
    if (!listing) {
      return res.status(404).json({ error: "Invalid or expired management link." });
    }

    return res.json({ success: true, listing });
  } catch (error) {
    console.error("Get listing by manage token error:", error);
    return res.status(500).json({ error: "Failed to retrieve listing." });
  }
}

export async function updateListingByManageToken(req, res) {
  try {
    const { token } = req.params;
    const listing = await AxxGoListing.findOne({ manageToken: token });
    if (!listing) {
      return res.status(404).json({ error: "Invalid or expired management link." });
    }

    let {
      title,
      description,
      price,
      priceType,
      pricePeriod,
      county,
      area,
      status,
      categoryFields,
      existingPhotos,
    } = req.body;

    if (title) listing.title = sanitizeString(title);
    if (description) listing.description = sanitizeString(description);
    if (county) listing.location.county = sanitizeString(county);
    if (area) listing.location.area = sanitizeString(area);
    if (price !== undefined && !isNaN(Number(price))) listing.price = Number(price);
    if (priceType && ["fixed", "negotiable", "contact_for_price"].includes(priceType)) {
      listing.priceType = priceType;
    }
    if (pricePeriod && ["one-off", "per-month", "per-night"].includes(pricePeriod)) {
      listing.pricePeriod = pricePeriod;
    }

    // Allow poster to update status to "active", "sold", "rented", "unavailable"
    if (status && ["active", "sold", "rented", "unavailable"].includes(status)) {
      listing.status = status;
    }

    // Update category fields
    if (categoryFields) {
      let parsed = categoryFields;
      if (typeof categoryFields === "string") {
        try {
          parsed = JSON.parse(categoryFields);
        } catch (e) {
          parsed = {};
        }
      }
      listing.categoryFields = { ...listing.categoryFields, ...parsed };
    }

    // Handle photos updates
    let updatedPhotos = [];
    if (existingPhotos) {
      let parsedExisting = existingPhotos;
      if (typeof existingPhotos === "string") {
        try {
          parsedExisting = JSON.parse(existingPhotos);
        } catch (e) {
          parsedExisting = [];
        }
      }
      if (Array.isArray(parsedExisting)) {
        updatedPhotos = parsedExisting.filter((p) => typeof p === "string" && p.startsWith("http"));
      }
    } else {
      updatedPhotos = listing.photos || [];
    }

    // Process any newly uploaded photos
    if (req.files && req.files.length > 0) {
      const newUrls = await processAndStoreAxxGoImages(req.files);
      updatedPhotos = [...updatedPhotos, ...newUrls].slice(0, 8);
    }

    if (updatedPhotos.length > 0) {
      listing.photos = updatedPhotos;
    }

    await listing.save();

    return res.json({
      success: true,
      message: "Listing updated successfully.",
      listing,
    });
  } catch (error) {
    console.error("Update listing by manage token error:", error);
    return res.status(500).json({ error: error.message || "Failed to update listing." });
  }
}

// Renew listing for another 30 days
export async function renewListingByManageToken(req, res) {
  try {
    const { token } = req.params;
    const listing = await AxxGoListing.findOne({ manageToken: token });
    if (!listing) {
      return res.status(404).json({ error: "Invalid management token." });
    }

    listing.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (listing.status === "expired") {
      listing.status = "active";
    }
    await listing.save();

    return res.json({
      success: true,
      message: "Listing renewed for 30 days!",
      expiresAt: listing.expiresAt,
    });
  } catch (error) {
    console.error("Renew listing error:", error);
    return res.status(500).json({ error: "Failed to renew listing." });
  }
}

// Delete listing by secret token
export async function deleteListingByManageToken(req, res) {
  try {
    const { token } = req.params;
    const listing = await AxxGoListing.findOneAndDelete({ manageToken: token });
    if (!listing) {
      return res.status(404).json({ error: "Invalid management token." });
    }

    // Clean up related reports
    await AxxGoReport.deleteMany({ listing: listing._id });

    return res.json({
      success: true,
      message: "Listing and associated reports have been permanently deleted.",
    });
  } catch (error) {
    console.error("Delete listing error:", error);
    return res.status(500).json({ error: "Failed to delete listing." });
  }
}

// ====================== 5B. GET MY PUBLISHED LISTINGS ======================
export async function getMyListings(req, res) {
  try {
    if (!req.user || req.user.role === "guest") {
      return res.status(403).json({ error: "Only registered AxxSpace users can view their listings." });
    }
    const listings = await AxxGoListing.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.json({ success: true, count: listings.length, listings });
  } catch (error) {
    console.error("Get my listings error:", error);
    return res.status(500).json({ error: "Failed to fetch your listings." });
  }
}

// ====================== 6. ADMIN CLEANUP (AFTER THE FACT) ======================
export async function adminGetReports(req, res) {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status && ["open", "reviewed", "dismissed", "actioned"].includes(status)) {
      filter.status = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [reports, total] = await Promise.all([
      AxxGoReport.find(filter)
        .populate("listing")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AxxGoReport.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      reports,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Admin get reports error:", error);
    return res.status(500).json({ error: "Failed to fetch reports." });
  }
}

export async function adminUpdateReport(req, res) {
  try {
    const { id } = req.params;
    const { status, actionTaken } = req.body;

    const report = await AxxGoReport.findById(id);
    if (!report) return res.status(404).json({ error: "Report not found." });

    if (status) report.status = status;
    if (actionTaken) report.actionTaken = sanitizeString(actionTaken);
    report.reviewedBy = req.user?._id || null;
    report.reviewedAt = new Date();

    await report.save();

    return res.json({ success: true, message: "Report updated successfully.", report });
  } catch (error) {
    console.error("Admin update report error:", error);
    return res.status(500).json({ error: "Failed to update report." });
  }
}

export async function adminToggleHideListing(req, res) {
  try {
    const { id } = req.params;
    const { hide } = req.body;

    const listing = await AxxGoListing.findById(id);
    if (!listing) return res.status(404).json({ error: "Listing not found." });

    listing.status = hide ? "hidden" : "active";
    if (!hide) {
      // If unhiding, reset reportCount so it doesn't get instantly re-hidden
      listing.reportCount = 0;
    }
    await listing.save();

    return res.json({
      success: true,
      message: hide ? "Listing has been hidden." : "Listing has been unhidden.",
      listing,
    });
  } catch (error) {
    console.error("Admin toggle hide listing error:", error);
    return res.status(500).json({ error: "Failed to update listing status." });
  }
}

export async function adminDeleteListing(req, res) {
  try {
    const { id } = req.params;
    const listing = await AxxGoListing.findByIdAndDelete(id);
    if (!listing) return res.status(404).json({ error: "Listing not found." });

    await AxxGoReport.deleteMany({ listing: id });

    return res.json({ success: true, message: "Listing deleted permanently." });
  } catch (error) {
    console.error("Admin delete listing error:", error);
    return res.status(500).json({ error: "Failed to delete listing." });
  }
}

export async function adminBanEntity(req, res) {
  try {
    const { type, value, reason } = req.body;
    if (!type || !["phone", "ip"].includes(type) || !value) {
      return res.status(400).json({ error: "Type (phone or ip) and value are required." });
    }

    const cleanValue = type === "phone" ? normalizePhone(value).toLowerCase() : value.trim().toLowerCase();

    const banned = await AxxGoBanned.findOneAndUpdate(
      { type, value: cleanValue },
      {
        type,
        value: cleanValue,
        reason: sanitizeString(reason || "Policy violation"),
        bannedBy: req.user?._id || null,
      },
      { upsert: true, new: true }
    );

    // If banning phone or IP, also auto-hide existing listings from this phone or IP
    if (type === "phone") {
      await AxxGoListing.updateMany({ "poster.phone": cleanValue }, { status: "hidden" });
    } else if (type === "ip") {
      await AxxGoListing.updateMany({ ip: cleanValue }, { status: "hidden" });
    }

    return res.json({ success: true, message: `Banned ${type}: ${cleanValue}`, banned });
  } catch (error) {
    console.error("Admin ban error:", error);
    return res.status(500).json({ error: "Failed to ban entity." });
  }
}

export async function adminGetBanned(req, res) {
  try {
    const banned = await AxxGoBanned.find().sort({ createdAt: -1 });
    return res.json({ success: true, banned });
  } catch (error) {
    console.error("Admin get banned error:", error);
    return res.status(500).json({ error: "Failed to fetch banned list." });
  }
}

export async function adminUnbanEntity(req, res) {
  try {
    const { id } = req.params;
    const deleted = await AxxGoBanned.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Ban record not found." });

    return res.json({ success: true, message: "Ban removed successfully." });
  } catch (error) {
    console.error("Admin unban error:", error);
    return res.status(500).json({ error: "Failed to remove ban." });
  }
}

