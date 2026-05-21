import express from "express";
import User from "../models/User.js"; // Or your Mover schema if separated
// import { protect } from "../middleware/authMiddleware.js"; // If profile routes need protection

const router = express.Router();

// @desc    Get all approved movers filtered by county (Public route for clients)
// @route   GET /api/movers
router.get("/", async (req, res) => {
  try {
    const { county } = req.query;
    let query = { role: "mover" }; // Only look for movers, not clients

    // If a specific county is provided and it's not "all", filter down the nodes
    if (county && county !== "all") {
      // Matches county field case-insensitively
      query.county = { $regex: new RegExp("^" + county + "$", "i") };
    }

    const movers = await User.find(query)
      .select("name email county vehicleType services experienceYears phone bio")
      .sort({ createdAt: -1 });

    res.json(movers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;