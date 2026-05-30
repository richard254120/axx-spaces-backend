import express from "express";
import { auth } from "../middleware/auth.js";
import PaymentVerification from "../models/PaymentVerification.js";
import Property from "../models/Property.js";
import TourismListing from "../models/TourismListing.js";
import User from "../models/User.js";

const router = express.Router();

// ====================== SUBMIT PAYMENT VERIFICATION ======================
router.post("/submit", auth, async (req, res) => {
  try {
    const {
      propertyId,
      tourismPropertyId,
      type,
      amount,
      mpesaMessage,
      mpesaTransactionId,
      phoneNumber,
      plan,
    } = req.body;

    if (!type || !amount || !mpesaMessage || !phoneNumber) {
      return res.status(400).json({ error: "Type, amount, M-Pesa message, and phone number are required" });
    }

    if (!propertyId && !tourismPropertyId && type !== "premium_plan") {
      return res.status(400).json({ error: "Property ID or Tourism Property ID is required" });
    }

    const verification = await PaymentVerification.create({
      user: req.user._id,
      propertyId,
      tourismPropertyId,
      type,
      amount,
      mpesaMessage,
      mpesaTransactionId,
      phoneNumber,
      plan,
      status: "pending",
    });

    console.log(`✅ Payment verification submitted by user: ${req.user.email}`);
    res.status(201).json({
      success: true,
      message: "Payment verification submitted successfully. Admin will review it shortly.",
      verification,
    });
  } catch (err) {
    console.error("❌ Failed to submit payment verification:", err);
    res.status(500).json({ error: "Failed to submit payment verification" });
  }
});

// ====================== GET USER PAYMENT VERIFICATIONS ======================
router.get("/my", auth, async (req, res) => {
  try {
    const verifications = await PaymentVerification.find({ user: req.user._id })
      .populate("propertyId", "title")
      .populate("tourismPropertyId", "name")
      .sort({ createdAt: -1 });

    res.json(verifications);
  } catch (err) {
    console.error("❌ Failed to fetch payment verifications:", err);
    res.status(500).json({ error: "Failed to fetch payment verifications" });
  }
});

// ====================== GET PENDING PAYMENT VERIFICATIONS (ADMIN) ======================
router.get("/pending", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const pendingVerifications = await PaymentVerification.find({ status: "pending" })
      .populate("user", "name email phone")
      .populate("propertyId", "title location county")
      .populate("tourismPropertyId", "name location county")
      .sort({ createdAt: -1 });

    res.json(pendingVerifications);
  } catch (err) {
    console.error("❌ Failed to fetch pending payment verifications:", err);
    res.status(500).json({ error: "Failed to fetch pending payment verifications" });
  }
});

// ====================== APPROVE/REJECT PAYMENT VERIFICATION (ADMIN) ======================
router.patch("/:verificationId/process", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { verificationId } = req.params;
    const { approve, adminNotes } = req.body;

    const verification = await PaymentVerification.findById(verificationId);

    if (!verification) {
      return res.status(404).json({ error: "Payment verification not found" });
    }

    if (verification.status !== "pending") {
      return res.status(400).json({ error: "Payment verification has already been processed" });
    }

    verification.status = approve ? "approved" : "rejected";
    verification.adminNotes = adminNotes || "";
    verification.processedAt = new Date();

    if (approve) {
      // Activate the listing/feature based on type
      if (verification.type === "listing_boost" && verification.propertyId) {
        const property = await Property.findById(verification.propertyId);
        if (property) {
          property.isFeatured = true;
          property.featuredUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
          await property.save();
          console.log(`✅ Property featured: ${property.title}`);
        }
      } else if (verification.type === "tourism_package" && verification.tourismPropertyId) {
        const tourismProperty = await TourismListing.findById(verification.tourismPropertyId);
        if (tourismProperty) {
          tourismProperty.isFeatured = true;
          tourismProperty.featuredUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
          await tourismProperty.save();
          console.log(`✅ Tourism property featured: ${tourismProperty.name}`);
        }
      } else if (verification.type === "premium_plan") {
        const user = await User.findById(verification.user);
        if (user) {
          user.walletBalance = (user.walletBalance || 0) + verification.amount;
          await user.save();
          console.log(`✅ User wallet updated: ${user.email}`);
        }
      }
    }

    await verification.save();
    console.log(`✅ Payment verification ${approve ? 'approved' : 'rejected'}: ${verification._id}`);

    res.json({
      success: true,
      message: `Payment verification ${approve ? 'approved' : 'rejected'} successfully`,
      verification,
    });
  } catch (err) {
    console.error("❌ Failed to process payment verification:", err);
    res.status(500).json({ error: "Failed to process payment verification" });
  }
});

export default router;
