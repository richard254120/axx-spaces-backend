import express from "express";
import {
  getMoverStats,
  getAllMovers,
  getMoverProfile,
  updateMoverProfile,
  uploadPortfolio,
  deletePortfolioImage,
  updatePricing,
  updateCertifications,
  updateInsurance,
} from "../controllers/moverController.js";
import { auth, requireRole } from "../middleware/auth.js";
import { uploadMoverPortfolio } from "../config/multerBusiness.js";

const router = express.Router();

// Public — used by the search page (no login required)
router.get("/", getAllMovers);

// Protected — mover must be logged in
router.get("/stats", auth, requireRole("mover", "admin", "provider"), getMoverStats);
router.get("/profile", auth, requireRole("mover", "admin", "provider"), getMoverProfile);
router.put("/profile", auth, requireRole("mover", "admin", "provider"), updateMoverProfile);

// Portfolio management
router.post("/portfolio", auth, requireRole("mover", "admin", "provider"), uploadMoverPortfolio.array("images", 10), uploadPortfolio);
router.delete("/portfolio/:index", auth, requireRole("mover", "admin", "provider"), deletePortfolioImage);

// Enhanced profile endpoints
router.put("/pricing", auth, updatePricing);
router.put("/certifications", auth, updateCertifications);
router.put("/insurance", auth, updateInsurance);

export default router;