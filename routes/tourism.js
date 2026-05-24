import express from "express";
import { auth } from "../middleware/auth.js";
import upload from "../config/multer.js";
import {
  getListings,
  getFeatured,
  getStats,
  getCategories,
  getListingById,
  getMyListings,
  createListing,
  registerProviderListing,
  addReview,
  incrementView,
  updateListingStatus,
} from "../controllers/tourismController.js";

const router = express.Router();

router.get("/stats", getStats);
router.get("/featured", getFeatured);
router.get("/categories", getCategories);
router.get("/my", auth, getMyListings);
router.get("/", getListings);

router.post("/register", upload.array("images", 10), registerProviderListing);
router.post("/", auth, upload.array("images", 10), createListing);

router.get("/:id", getListingById);
router.patch("/:id/view", incrementView);
router.post("/:id/reviews", addReview);
router.patch("/:id/status", auth, updateListingStatus);

export default router;
