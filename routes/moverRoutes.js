import express from "express";
import { 
  getAllMovers, // Renamed from getMoversByCounty to match the controller I gave you
  updateMoverProfile, 
  getMoverStats 
} from "../controllers/moverController.js";

// ✅ FIXED: Matching your actual filename (auth.js) and exported function (auth)
import { auth } from "../middleware/auth.js"; 

const router = express.Router();

/**
 * PUBLIC ROUTES
 */
router.get("/", getAllMovers);


/**
 * PRIVATE ROUTES (Protected by JWT)
 */

// Updates business details
router.put("/profile", auth, updateMoverProfile);

// Fetches earnings and job counts
router.get("/stats", auth, getMoverStats);

export default router;