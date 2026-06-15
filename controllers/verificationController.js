import Verification from "../models/Verification.js";
import User from "../models/User.js";
import { faceMatchService } from "../services/faceMatchService.js";
import { toAbsoluteUploadUrl } from "../utils/fileUrls.js";
import { notifyUser } from "../utils/userNotifications.js";

function enrichVerificationMedia(verification) {
  if (!verification) return verification;
  const data = verification.toObject ? verification.toObject() : { ...verification };

  if (Array.isArray(data.documents)) {
    data.documents = data.documents.map((doc) => ({
      ...doc,
      url: toAbsoluteUploadUrl(doc.url),
    }));
  }

  if (data.selfie?.url) {
    data.selfie = {
      ...data.selfie,
      url: toAbsoluteUploadUrl(data.selfie.url),
    };
  }

  return data;
}

// @desc    Submit verification
// @route   POST /api/verification/submit
// @access  Private
export const submitVerification = async (req, res) => {
  try {
    const { verificationLevel, idType, businessName, taxId, physicalDetails } = req.body;
    const userId = req.user._id;
    const level = parseInt(verificationLevel, 10) || 1;

    // Check if there's a pending verification for this specific level
    const existingVerification = await Verification.findOne({
      user: userId,
      verificationLevel: level,
      status: { $in: ["pending", "under_review"] },
    });

    if (existingVerification) {
      return res.status(400).json({
        success: false,
        message: `You already have a Level ${level} verification pending review`,
      });
    }

    // Create new verification
    const verification = await Verification.create({
      user: userId,
      verificationLevel: level,
      idType,
      businessName,
      taxId,
      physicalDetails,
      documents: req.uploadedDocuments || [],
      selfie: req.uploadedSelfie || null,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    // Perform face matching if standard identity verification (level 2) and selfie is uploaded
    if (level === 2 && req.uploadedSelfie && req.uploadedDocuments?.length > 0) {
      try {
        const faceMatchResult = await faceMatchService.compareFaces(
          req.uploadedSelfie.url,
          req.uploadedDocuments[0].url
        );

        verification.selfie.faceMatchScore = faceMatchResult.score;
        await verification.save();
      } catch (error) {
        console.error("Face matching error:", error);
      }
    }

    // Update user status field
    const userField = level === 1
      ? "studentVerificationStatus"
      : level === 2
        ? "standardVerificationStatus"
        : "premiumVerificationStatus";

    await User.findByIdAndUpdate(userId, {
      [userField]: "pending",
      verificationStatus: "pending"
    });

    res.status(201).json({
      success: true,
      message: "Verification submitted successfully",
      data: verification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to submit verification",
    });
  }
};

// @desc    Get user verification status
// @route   GET /api/verification/status
// @access  Private
export const getVerificationStatus = async (req, res) => {
  try {
    const userId = req.user._id;

    const verifications = await Verification.find({ user: userId })
      .sort({ submittedAt: -1 })
      .populate("reviewedBy", "name email");

    const latestByLevel = {};
    for (const v of verifications) {
      if (!latestByLevel[v.verificationLevel]) {
        latestByLevel[v.verificationLevel] = v;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        verificationLevel: req.user.verificationLevel || 1,
        verificationStatus: req.user.verificationStatus || "pending",
        verificationBadges: req.user.verificationBadges || [],
        studentVerificationStatus: req.user.studentVerificationStatus || "none",
        standardVerificationStatus: req.user.standardVerificationStatus || "none",
        premiumVerificationStatus: req.user.premiumVerificationStatus || "none",
        levels: {
          student: latestByLevel[1] || null,
          standard: latestByLevel[2] || null,
          premium: latestByLevel[3] || null,
        }
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get verification status",
    });
  }
};

// @desc    Get verification history
// @route   GET /api/verification/history
// @access  Private
export const getVerificationHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    const verifications = await Verification.find({ user: userId })
      .sort({ submittedAt: -1 })
      .populate("reviewedBy", "name email");

    res.status(200).json({
      success: true,
      data: verifications,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get verification history",
    });
  }
};

// @desc    Get all pending verifications (Admin)
// @route   GET /api/verification/admin/pending
// @access  Private (Admin only)
export const getPendingVerifications = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = "pending" } = req.query;

    let statusFilter;
    if (status === "pending") {
      statusFilter = { $in: ["pending", "under_review"] };
    } else {
      statusFilter = status;
    }

    const verifications = await Verification.find({
      status: statusFilter,
    })
      .populate("user", "name email phone profileImage")
      .sort({ submittedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Verification.countDocuments({
      status: statusFilter,
    });

    res.status(200).json({
      success: true,
      data: verifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get pending verifications",
    });
  }
};

// @desc    Approve verification (Admin)
// @route   PUT /api/verification/admin/:id/approve
// @access  Private (Admin only)
export const approveVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;
    const adminId = req.user._id;

    const verification = await Verification.findById(id);

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: "Verification not found",
      });
    }

    // Update verification status
    verification.status = "approved";
    verification.reviewedAt = new Date();
    verification.reviewedBy = adminId;
    verification.adminNotes = adminNotes || "Approved by admin";

    const level = verification.verificationLevel;
    const userField = level === 1
      ? "studentVerificationStatus"
      : level === 2
        ? "standardVerificationStatus"
        : "premiumVerificationStatus";

    const badge = level === 1
      ? "student_verified"
      : level === 2
        ? "standard_verified"
        : "premium_verified";

    const updateObj = {
      [userField]: "approved",
      verificationStatus: "approved",
    };

    // Only increase user's general verificationLevel, do not downgrade
    const currentUser = await User.findById(verification.user);
    if (currentUser && level > (currentUser.verificationLevel || 1)) {
      updateObj.verificationLevel = level;
    }

    await User.findByIdAndUpdate(verification.user, {
      $set: updateObj,
      $addToSet: { verificationBadges: badge }
    });

    await verification.save();

    await notifyUser(verification.user, {
      type: "kyc_approved",
      title: "✅ Verification approved",
      message: `Your Level ${verification.verificationLevel} verification has been approved.`,
      data: { verificationId: String(verification._id), level: verification.verificationLevel },
    });

    res.status(200).json({
      success: true,
      message: "Verification approved successfully",
      data: verification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to approve verification",
    });
  }
};

// @desc    Reject verification (Admin)
// @route   PUT /api/verification/admin/:id/reject
// @access  Private (Admin only)
export const rejectVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason, adminNotes } = req.body;
    const adminId = req.user._id;

    const verification = await Verification.findById(id);

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: "Verification not found",
      });
    }

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    // Update verification status
    verification.status = "rejected";
    verification.rejectionReason = rejectionReason;
    verification.reviewedAt = new Date();
    verification.reviewedBy = adminId;
    verification.adminNotes = adminNotes || "Rejected by admin";

    const level = verification.verificationLevel;
    const userField = level === 1
      ? "studentVerificationStatus"
      : level === 2
        ? "standardVerificationStatus"
        : "premiumVerificationStatus";

    const badge = level === 1
      ? "student_verified"
      : level === 2
        ? "standard_verified"
        : "premium_verified";

    await User.findByIdAndUpdate(verification.user, {
      $set: {
        [userField]: "rejected",
        verificationStatus: "rejected",
      },
      $pull: { verificationBadges: badge }
    });

    await verification.save();

    await notifyUser(verification.user, {
      type: "kyc_rejected",
      title: "❌ Verification rejected",
      message: `Your Level ${verification.verificationLevel} verification was rejected. Reason: ${rejectionReason}`,
      data: { verificationId: String(verification._id), level: verification.verificationLevel },
    });

    res.status(200).json({
      success: true,
      message: "Verification rejected successfully",
      data: verification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to reject verification",
    });
  }
};

// @desc    Get verification details (Admin)
// @route   GET /api/verification/admin/:id
// @access  Private (Admin only)
export const getVerificationDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const verification = await Verification.findById(id)
      .populate("user", "name email phone profileImage role studentVerificationStatus standardVerificationStatus premiumVerificationStatus verificationBadges")
      .populate("reviewedBy", "name email");

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: "Verification not found",
      });
    }

    res.status(200).json({
      success: true,
      data: enrichVerificationMedia(verification),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get verification details",
    });
  }
};

// @desc    Resubmit verification
// @route   POST /api/verification/resubmit/:id
// @access  Private
export const resubmitVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const verification = await Verification.findById(id);

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: "Verification not found",
      });
    }

    if (verification.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only resubmit your own verification",
      });
    }

    if (verification.status !== "rejected") {
      return res.status(400).json({
        success: false,
        message: "Only rejected verifications can be resubmitted",
      });
    }

    // Reset verification status
    verification.status = "pending";
    verification.rejectionReason = "";
    verification.reviewedAt = null;
    verification.reviewedBy = null;
    verification.adminNotes = "";
    verification.submittedAt = new Date();

    // Update documents if new ones are provided
    if (req.uploadedDocuments && req.uploadedDocuments.length > 0) {
      verification.documents = req.uploadedDocuments;
    }

    if (req.uploadedSelfie) {
      verification.selfie = req.uploadedSelfie;
    }

    const level = verification.verificationLevel;
    const userField = level === 1
      ? "studentVerificationStatus"
      : level === 2
        ? "standardVerificationStatus"
        : "premiumVerificationStatus";

    await User.findByIdAndUpdate(userId, {
      [userField]: "pending",
      verificationStatus: "pending",
    });

    await verification.save();

    res.status(200).json({
      success: true,
      message: "Verification resubmitted successfully",
      data: verification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to resubmit verification",
    });
  }
};
