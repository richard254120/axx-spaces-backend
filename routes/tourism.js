import express from "express";
import { auth } from "../middleware/auth.js";
import upload from "../config/multer.js";
import tourismUpload from "../config/multerTourism.js";
import {
  getListings,
  getFeatured,
  getStats,
  getCategories,
  getListingById,
  getMyListings,
  getOwnerProfile,
  updateOwnerProfile,
  getOwnerListing,
  updateOwnerListing,
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

// Owner portal (must be before /:id)
router.get("/owner/profile", auth, getOwnerProfile);
router.patch("/owner/profile", auth, updateOwnerProfile);
router.get("/owner/listings/:id", auth, getOwnerListing);
router.patch(
  "/owner/listings/:id",
  auth,
  tourismUpload.fields([
    { name: "images", maxCount: 10 },
    { name: "videos", maxCount: 5 },
  ]),
  updateOwnerListing
);

router.get("/my", auth, getMyListings);
router.get("/", getListings);

router.post("/register", upload.array("images", 10), registerProviderListing);
router.post("/", auth, upload.array("images", 10), createListing);

router.get("/:id", getListingById);
router.patch("/:id/view", incrementView);
router.post("/:id/reviews", addReview);
router.patch("/:id/status", auth, updateListingStatus);

export default router;
