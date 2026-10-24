import express from "express";
import jwt from "jsonwebtoken";
import { auth, requireRole } from "../middleware/auth.js";
import User from "../models/User.js";
import { formatUserResponse } from "../utils/formatUser.js";

const router = express.Router();

// PATCH /api/users/become-provider (member only)
router.patch("/become-provider", auth, requireRole("member"), async (req, res) => {
  try {
    const { businessName, county, description, services } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.role = "provider";
    if (businessName) user.company = businessName.trim();
    if (county) user.county = county.trim();
    if (description) user.description = description.trim();
    if (Array.isArray(services)) user.services = services;

    await user.save();

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      message: "Congratulations! You are now an Axxspace Provider.",
      token,
      user: formatUserResponse(user),
    });
  } catch (err) {
    console.error("Become provider error:", err);
    return res.status(500).json({ error: err.message || "Failed to update provider role" });
  }
});

export default router;
