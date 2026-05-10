import User from "../models/User.js";

// @desc    Get stats for the mover dashboard
// @route   GET /api/movers/stats
export const getMoverStats = async (req, res) => {
  try {
    const mover = await User.findById(req.user.id);
    if (!mover) return res.status(404).json({ message: "Mover not found" });

    // For now, returning basic stats. You can expand this later.
    res.json({
      name: mover.name,
      isApproved: mover.isApproved,
      county: mover.county,
      experience: mover.experienceYears,
      services: mover.services,
      walletBalance: mover.walletBalance
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Search/Get all approved movers by county
// @route   GET /api/movers
export const getAllMovers = async (req, res) => {
  try {
    const { county } = req.query;
    const query = { role: "mover", isApproved: true };
    
    if (county) query.county = county;

    const movers = await User.find(query).select("-password");
    res.json(movers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update mover profile
// @route   PUT /api/movers/profile
export const updateMoverProfile = async (req, res) => {
  try {
    const updatedMover = await User.findByIdAndUpdate(
      req.user.id,
      { $set: req.body },
      { new: true }
    ).select("-password");

    res.json(updatedMover);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};