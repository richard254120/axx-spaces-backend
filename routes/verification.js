import express from "express";
import SellerVerification from "../models/SellerVerification.js";
import { auth } from "../middleware/auth.js";
import upload from "../config/multer.js";

const router = express.Router();

// ============ APPLY FOR SELLER VERIFICATION ============
router.post("/apply", auth, upload.array("documents", 3), async (req, res) => {
  try {
    const { businessName, businessRegNumber, kraPin, idNumber } = req.body;

    // Validation
    if (!businessName || !businessRegNumber || !kraPin || !idNumber) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check if already verified
    const existingVerification = await SellerVerification.findOne({
      seller: req.user._id,
    });

    if (existingVerification && existingVerification.status === "verified") {
      return res.status(400).json({ error: "Already verified" });
    }

    const documentUrls = req.files ? req.files.map((file) => file.path) : [];

    // Create or update verification
    let verification;
    if (existingVerification) {
      verification = existingVerification;
      verification.businessName = businessName;
      verification.businessRegNumber = businessRegNumber;
      verification.kraPin = kraPin;
      verification.idNumber = idNumber;
      verification.documents = documentUrls;
      verification.status = "pending";
      verification.rejectionReason = null;
    } else {
      verification = new SellerVerification({
        seller: req.user._id,
        businessName,
        businessRegNumber,
        kraPin,
        idNumber,
        documents: documentUrls,
        status: "pending",
      });
    }

    await verification.save();

    res.json({
      success: true,
      message: "Application submitted. Awaiting admin review.",
      verification,
    });
  } catch (error) {
    console.error("Apply verification error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ GET VERIFICATION STATUS ============
router.get("/status", auth, async (req, res) => {
  try {
    const verification = await SellerVerification.findOne({
      seller: req.user._id,
    });

    if (!verification) {
      return res.json({
        status: "none",
        message: "Not yet applied",
      });
    }

    res.json({
      status: verification.status,
      verification,
    });
  } catch (error) {
    console.error("Get status error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN: GET PENDING VERIFICATIONS ============
router.get("/admin/pending", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const pending = await SellerVerification.find({ status: "pending" })
      .populate("seller", "name email phone")
      .sort({ createdAt: -1 });

    res.json(pending);
  } catch (error) {
    console.error("Get pending error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN: APPROVE VERIFICATION ============
router.patch("/:id/approve", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const verification = await SellerVerification.findByIdAndUpdate(
      req.params.id,
      {
        status: "verified",
        verifiedAt: new Date(),
        verifiedBy: req.user._id,
        rejectionReason: null,
      },
      { new: true }
    );

    if (!verification) {
      return res.status(404).json({ error: "Verification not found" });
    }

    res.json({
      success: true,
      message: "Seller verified successfully!",
      verification,
    });
  } catch (error) {
    console.error("Approve error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN: REJECT VERIFICATION ============
router.patch("/:id/reject", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const { reason } = req.body;

    const verification = await SellerVerification.findByIdAndUpdate(
      req.params.id,
      {
        status: "rejected",
        rejectionReason: reason || "Documents incomplete",
      },
      { new: true }
    );

    if (!verification) {
      return res.status(404).json({ error: "Verification not found" });
    }

    res.json({
      success: true,
      message: "Application rejected",
      verification,
    });
  } catch (error) {
    console.error("Reject error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ GET VERIFIED SELLERS ============
router.get("/sellers/verified", async (req, res) => {
  try {
    const verified = await SellerVerification.find({ status: "verified" })
      .populate("seller", "name phone")
      .select("seller rating completedTransactions responseTime");

    res.json(verified);
  } catch (error) {
    console.error("Get verified sellers error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;