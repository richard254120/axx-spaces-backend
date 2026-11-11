import express from "express";
import rateLimit from "express-rate-limit";
import { axxGoUpload } from "../utils/axxgoImageProcessor.js";
import { auth, adminOnly } from "../middleware/auth.js";
import {
  createListing,
  getListings,
  getListingById,
  reportListing,
  getListingByManageToken,
  updateListingByManageToken,
  renewListingByManageToken,
  deleteListingByManageToken,
  adminGetReports,
  adminUpdateReport,
  adminToggleHideListing,
  adminDeleteListing,
  adminBanEntity,
  adminGetBanned,
  adminUnbanEntity,
} from "../controllers/axxgoController.js";

const router = express.Router();

// Strict rate limiter for creating new classifieds: max 5 posts per hour per IP
const axxGoPostLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: "You have reached the posting limit of 5 listings per hour. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for reporting listings: max 10 reports per 15 minutes
const axxGoReportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many reports submitted. Please wait before reporting again." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ====================== PUBLIC CLASSIFIEDS ENDPOINTS ======================
// 1. Browse listings (category, county, area, price, keyword search, pagination)
router.get("/listings", getListings);

// 2. View single listing details
router.get("/listings/:id", getListingById);

// 3. Post a listing (instant live, no account required, 1-8 photos)
router.post(
  "/listings",
  axxGoPostLimiter,
  axxGoUpload.array("photos", 8),
  createListing
);

// 4. Report a listing
router.post("/listings/:id/report", axxGoReportLimiter, reportListing);

// ====================== ACCOUNT-FREE MANAGEMENT ENDPOINTS ======================
// Uses unique secret manageToken
router.get("/manage/:token", getListingByManageToken);
router.put(
  "/manage/:token",
  axxGoUpload.array("photos", 8),
  updateListingByManageToken
);
router.post("/manage/:token/renew", renewListingByManageToken);
router.delete("/manage/:token", deleteListingByManageToken);

// ====================== ADMIN CLEANUP ENDPOINTS ======================
// Accessible only to authenticated admins
router.get("/admin/reports", auth, adminOnly, adminGetReports);
router.put("/admin/reports/:id", auth, adminOnly, adminUpdateReport);
router.post("/admin/listings/:id/hide", auth, adminOnly, adminToggleHideListing);
router.delete("/admin/listings/:id", auth, adminOnly, adminDeleteListing);
router.post("/admin/ban", auth, adminOnly, adminBanEntity);
router.get("/admin/banned", auth, adminOnly, adminGetBanned);
router.delete("/admin/banned/:id", auth, adminOnly, adminUnbanEntity);

export default router;

