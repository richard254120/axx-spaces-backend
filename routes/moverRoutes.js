import express from "express";
import {
  getMoverStats,
  getAllMovers,
  getMoverProfile,
  updateMoverProfile,
} from "../controllers/moverController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// Public — used by the search page (no login required)
router.get("/", getAllMovers);

// Protected — mover must be logged in
router.get("/stats",   auth, getMoverStats);
router.get("/profile", auth, getMoverProfile);
router.put("/profile", auth, updateMoverProfile);

export default router;