import User from "../models/User.js";

// ====================== ISSUE BADGE TO USER ======================
export const issueUserBadge = async (req, res) => {
  try {
    const { userId, badgeType, paymentReference, amount } = req.body;
    const adminId = req.user._id;

    // Validate badge type
    const validBadgeTypes = [
      "premium_verified",
      "student_verified",
      "business_verified",
      "identity_verified",
      "location_verified",
      "online_verified",
    ];

    if (!validBadgeTypes.includes(badgeType)) {
      return res.status(400).json({ error: "Invalid badge type" });
    }

    // Find the user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if badge already exists
    const existingBadge = user.verificationBadges?.find(
      (badge) => badge.type === badgeType
    );

    if (existingBadge) {
      return res.status(400).json({ error: "Badge already issued to this user" });
    }

    // Add the badge
    const newBadge = {
      type: badgeType,
      verifiedAt: new Date(),
      verifiedBy: adminId,
      paymentReference: paymentReference || null,
      amount: amount || 0,
    };

    if (!user.verificationBadges) {
      user.verificationBadges = [];
    }

    user.verificationBadges.push(newBadge);
    await user.save();

    // Populate the verifiedBy field
    await user.populate("verificationBadges.verifiedBy", "name email");

    res.json({
      success: true,
      message: `Badge ${badgeType} issued successfully to user ${user.name}`,
      user,
    });
  } catch (error) {
    console.error("❌ Issue user badge error:", error);
    res.status(500).json({ error: error.message || "Failed to issue badge" });
  }
};

// ====================== REMOVE BADGE FROM USER ======================
export const removeUserBadge = async (req, res) => {
  try {
    const { userId, badgeType } = req.body;

    // Find the user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Remove the badge
    user.verificationBadges = user.verificationBadges.filter(
      (badge) => badge.type !== badgeType
    );

    await user.save();

    res.json({
      success: true,
      message: `Badge ${badgeType} removed successfully from user ${user.name}`,
      user,
    });
  } catch (error) {
    console.error("❌ Remove user badge error:", error);
    res.status(500).json({ error: error.message || "Failed to remove badge" });
  }
};

// ====================== GET USER BADGES ======================
export const getUserBadges = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate(
      "verificationBadges.verifiedBy",
      "name email"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      badges: user.verificationBadges || [],
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("❌ Get user badges error:", error);
    res.status(500).json({ error: error.message || "Failed to get badges" });
  }
};

// ====================== GET ALL USERS WITH BADGES (ADMIN) ======================
export const getAllUserBadges = async (req, res) => {
  try {
    const { badgeType, role } = req.query;

    let query = {};
    if (badgeType) {
      query["verificationBadges.type"] = badgeType;
    }
    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .populate("verificationBadges.verifiedBy", "name email")
      .sort({ createdAt: -1 });

    // Filter users that have badges
    const usersWithBadges = users.filter(
      (user) => user.verificationBadges && user.verificationBadges.length > 0
    );

    res.json({
      success: true,
      users: usersWithBadges,
    });
  } catch (error) {
    console.error("❌ Get all user badges error:", error);
    res.status(500).json({ error: error.message || "Failed to get user badges" });
  }
};

// ====================== GET USER BADGE STATISTICS (ADMIN) ======================
export const getUserBadgeStats = async (req, res) => {
  try {
    const badgeTypes = [
      "premium_verified",
      "student_verified",
      "business_verified",
      "identity_verified",
      "location_verified",
      "online_verified",
    ];

    const stats = {};

    for (const badgeType of badgeTypes) {
      const count = await User.countDocuments({
        "verificationBadges.type": badgeType,
      });
      stats[badgeType] = { total: count };
    }

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("❌ Get user badge stats error:", error);
    res.status(500).json({ error: error.message || "Failed to get badge statistics" });
  }
};

// ====================== SEARCH USERS FOR BADGE ISSUANCE ======================
export const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({ error: "Search query must be at least 2 characters" });
    }

    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
        { phone: { $regex: query, $options: "i" } },
      ],
    })
      .select("name email phone role verificationBadges")
      .limit(20);

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("❌ Search users error:", error);
    res.status(500).json({ error: error.message || "Failed to search users" });
  }
};
