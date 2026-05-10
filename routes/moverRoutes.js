import express from "express";
import { 
  getMoversByCounty, 
  updateMoverProfile, 
  getMoverStats 
} from "../controllers/moverController.js";
import { protect } from "../middleware/authMiddleware.js"; // Ensure this matches your middleware file name

const router = express.Router();

/**
 * PUBLIC ROUTES
 * These are used by renters searching for movers on the "Find a Mover" page.
 */
router.get("/", getMoversByCounty);


/**
 * PRIVATE ROUTES (Protected by JWT)
 * These are used by the Mover Dashboard.
 * The 'protect' middleware ensures only logged-in users with a valid token access these.
 */

// Updates business details (County, Description, etc.)
router.put("/profile", protect, updateMoverProfile);

// Fetches earnings and job counts for the dashboard cards
router.get("/stats", protect, getMoverStats);

export default router;