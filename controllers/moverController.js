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

// @desc    Upload portfolio images for mover
// @route   POST /api/movers/portfolio
export const uploadPortfolio = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const imageUrls = req.files.map((file) => file.path);
    const imageIds = req.files.map((file) => file.filename);

    const mover = await User.findById(req.user.id);
    if (!mover) return res.status(404).json({ message: "Mover not found" });

    // Add new images to portfolio (max 10)
    const currentPortfolio = mover.portfolioImages || [];
    const newImages = imageUrls;
    const updatedPortfolio = [...currentPortfolio, ...newImages].slice(0, 10);

    mover.portfolioImages = updatedPortfolio;
    await mover.save();

    res.json({
      message: "Portfolio images uploaded successfully",
      portfolioImages: mover.portfolioImages,
      uploadedUrls: imageUrls,
      uploadedIds: imageIds,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete portfolio image
// @route   DELETE /api/movers/portfolio/:index
export const deletePortfolioImage = async (req, res) => {
  try {
    const { index } = req.params;
    const mover = await User.findById(req.user.id);

    if (!mover) return res.status(404).json({ message: "Mover not found" });

    if (!mover.portfolioImages || mover.portfolioImages.length === 0) {
      return res.status(404).json({ message: "No portfolio images found" });
    }

    const imageIndex = parseInt(index);
    if (imageIndex < 0 || imageIndex >= mover.portfolioImages.length) {
      return res.status(400).json({ message: "Invalid image index" });
    }

    // Remove image from portfolio
    mover.portfolioImages.splice(imageIndex, 1);
    await mover.save();

    res.json({
      message: "Portfolio image deleted successfully",
      portfolioImages: mover.portfolioImages,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update mover pricing
// @route   PUT /api/movers/pricing
export const updatePricing = async (req, res) => {
  try {
    const { baseRate, rateType, minCharge, additionalServices } = req.body;

    const mover = await User.findById(req.user.id);
    if (!mover) return res.status(404).json({ message: "Mover not found" });

    mover.pricing = {
      baseRate: baseRate || mover.pricing?.baseRate || 0,
      rateType: rateType || mover.pricing?.rateType || "per_job",
      minCharge: minCharge || mover.pricing?.minCharge || 0,
      additionalServices: additionalServices || mover.pricing?.additionalServices || [],
    };

    await mover.save();

    res.json({
      message: "Pricing updated successfully",
      pricing: mover.pricing,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update mover certifications
// @route   PUT /api/movers/certifications
export const updateCertifications = async (req, res) => {
  try {
    const { certifications } = req.body;

    const mover = await User.findById(req.user.id);
    if (!mover) return res.status(404).json({ message: "Mover not found" });

    mover.certifications = certifications || [];
    await mover.save();

    res.json({
      message: "Certifications updated successfully",
      certifications: mover.certifications,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update mover insurance
// @route   PUT /api/movers/insurance
export const updateInsurance = async (req, res) => {
  try {
    const { hasInsurance, provider, coverageAmount, expiryDate } = req.body;

    const mover = await User.findById(req.user.id);
    if (!mover) return res.status(404).json({ message: "Mover not found" });

    mover.insurance = {
      hasInsurance: hasInsurance !== undefined ? hasInsurance : mover.insurance?.hasInsurance || false,
      provider: provider || mover.insurance?.provider || "",
      coverageAmount: coverageAmount || mover.insurance?.coverageAmount || 0,
      expiryDate: expiryDate || mover.insurance?.expiryDate || null,
    };

    await mover.save();

    res.json({
      message: "Insurance updated successfully",
      insurance: mover.insurance,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};