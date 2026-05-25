import User from "../models/User.js";
import { formatUserResponse } from "../utils/formatUser.js";

// @desc    Get stats for the mover dashboard
// @route   GET /api/movers/stats
export const getMoverStats = async (req, res) => {
  try {
    const mover = await User.findById(req.user.id).select("-password");
    if (!mover) return res.status(404).json({ message: "Mover not found" });

    res.json({
      name: mover.name,
      isApproved: mover.isApproved,
      county: mover.county,
      experience: mover.experienceYears,
      services: mover.services,
      walletBalance: mover.walletBalance || 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Search / Get all approved movers by county
// @route   GET /api/movers
export const getAllMovers = async (req, res) => {
  try {
    const { county } = req.query;
    const query = { role: "mover", isApproved: true };

    if (county && county !== "all" && county !== "") {
      query.county = { $regex: new RegExp(`^${county}$`, "i") };
    }

    const movers = await User.find(query).select("-password");
    res.json(movers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get logged-in mover's profile
// @route   GET /api/movers/profile
export const getMoverProfile = async (req, res) => {
  try {
    const mover = await User.findById(req.user._id || req.user.id).select("-password");
    if (!mover) return res.status(404).json({ message: "Mover not found" });
    res.json(formatUserResponse(mover));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update mover profile
// @route   PUT /api/movers/profile
export const updateMoverProfile = async (req, res) => {
  try {
    // Prevent role/approval tampering from the client
    const { role, isApproved, password, ...safeFields } = req.body;

    const updatedMover = await User.findByIdAndUpdate(
      req.user.id,
      { $set: safeFields },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedMover) return res.status(404).json({ message: "Mover not found" });

    res.json(updatedMover);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};