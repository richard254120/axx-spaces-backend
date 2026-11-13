import User from "../models/User.js";

/**
 * @desc    Get all approved movers filtered by county
 * @route   GET /api/movers
 * @access  Public (Used by Renters)
 */
export const getMoversByCounty = async (req, res) => {
  try {
    const { county } = req.query;

    // We only want users who are 'movers' and have been 'approved' by Admin
    const query = { 
      role: "mover", 
      isApproved: true 
    };

    // If a specific county is selected in the search bar, filter by it
    if (county && county !== "All") {
      query.county = { $regex: county, $options: "i" }; // Case-insensitive search
    }

    const movers = await User.find(query)
      .select("name email phone county vehicleType experienceYears description services")
      .sort({ createdAt: -1 });

    res.status(200).json(movers);
  } catch (error) {
    res.status(500).json({ 
      message: "Failed to retrieve movers", 
      error: error.message 
    });
  }
};

/**
 * @desc    Update Mover Business Profile
 * @route   PUT /api/movers/profile
 * @access  Private (Mover only)
 */
export const updateMoverProfile = async (req, res) => {
  try {
    // req.user.id comes from your 'protect' middleware
    const moverId = req.user.id;

    // Define the fields allowed to be updated from the dashboard
    const { 
      county, 
      experienceYears, 
      vehicleType, 
      description, 
      services 
    } = req.body;

    const updatedMover = await User.findByIdAndUpdate(
      moverId,
      {
        $set: {
          county,
          experienceYears,
          vehicleType,
          description,
          services,
        },
      },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedMover) {
      return res.status(404).json({ message: "Mover profile not found" });
    }

    res.status(200).json({
      message: "Profile updated successfully",
      data: updatedMover
    });
  } catch (error) {
    res.status(500).json({ 
      message: "Update failed", 
      error: error.message 
    });
  }
};

/**
 * @desc    Get Mover Stats (For Dashboard Overview)
 * @route   GET /api/movers/stats
 * @access  Private (Mover only)
 */
export const getMoverStats = async (req, res) => {
  try {
    const mover = await User.findById(req.user.id);
    
    // In a real app, you'd calculate this from a 'Jobs' or 'Leads' collection
    // For now, we return data that matches your Dashboard frontend
    res.status(200).json({
      totalEarnings: mover.walletBalance || 0,
      isApproved: mover.isApproved,
      activeJobs: 0, // Placeholder until you create a Jobs model
      completedJobs: 0
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching stats" });
  }
};