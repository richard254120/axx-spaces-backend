import express from "express";
import { auth } from "../middleware/auth.js";
import User from "../models/User.js";
import Property from "../models/Property.js";

const router = express.Router();

// ✅ Initiate Mpesa Payment
router.post("/initiate-mpesa", auth, async (req, res) => {
  try {
    const { phone, amount, propertyId, plan } = req.body;

    console.log("💳 Payment initiated:", { phone, amount, plan, propertyId });

    if (!phone || !amount) {
      return res.status(400).json({ error: "❌ Phone and amount required" });
    }

    if (amount < 100) {
      return res.status(400).json({ error: "❌ Amount must be at least 100 KES" });
    }

    let formattedPhone = phone.toString().replace(/\D/g, "");
    if (formattedPhone.startsWith("0")) formattedPhone = formattedPhone.substring(1);
    if (!formattedPhone.startsWith("254")) formattedPhone = "254" + formattedPhone;

    const transactionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await User.findByIdAndUpdate(req.user.id, {
      $push: {
        paymentHistory: {
          transactionId,
          amount,
          plan,
          propertyId: propertyId || null,
          status: "pending",
          date: new Date(),
        },
      },
    });

    console.log("✅ Transaction recorded:", transactionId);

    res.json({
      success: true,
      transactionId,
      message: "💳 Payment initiated. Please enter your Mpesa PIN.",
      phone: formattedPhone.slice(-9),
    });
  } catch (err) {
    console.error("❌ Payment error:", err);
    res.status(500).json({ error: err.message || "Failed to initiate payment" });
  }
});

// ✅ Verify Mpesa Payment
router.post("/verify-mpesa", auth, async (req, res) => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: "❌ Transaction ID required" });
    }

    const user = await User.findById(req.user.id);
    const payment = user.paymentHistory.find((p) => p.transactionId === transactionId);

    if (!payment) {
      return res.status(404).json({ error: "❌ Payment not found" });
    }

    if (payment.status === "success") {
      return res.json({
        success: true,
        message: "✅ Payment already confirmed",
        balance: user.walletBalance || 0,
      });
    }

    payment.status = "success";
    user.walletBalance = (user.walletBalance || 0) + payment.amount;

    if (payment.propertyId) {
      const property = await Property.findById(payment.propertyId);
      if (property && property.owner.toString() === req.user.id) {
        property.isFeatured = true;
        property.promotionStartDate = new Date();

        const durationDays =
          payment.plan === "boost-7days"
            ? 7
            : payment.plan === "premium-30days"
            ? 30
            : 30;

        property.promotionEndDate = new Date(
          Date.now() + durationDays * 24 * 60 * 60 * 1000
        );
        property.promotionTier = payment.plan;

        await property.save();
        console.log("✅ Property featured:", payment.propertyId);
      }
    }

    await user.save();

    res.json({
      success: true,
      message: "✅ Payment confirmed! Your boost is now active.",
      balance: user.walletBalance,
    });
  } catch (err) {
    console.error("❌ Verification error:", err);
    res.status(500).json({ error: err.message || "Failed to verify payment" });
  }
});

// ✅ Get Wallet Balance
router.get("/wallet", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      success: true,
      balance: user.walletBalance || 0,
      paymentHistory: user.paymentHistory || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch wallet" });
  }
});

// ✅ Get Featured Properties (Public)
router.get("/featured", async (req, res) => {
  try {
    const featured = await Property.find({
      isFeatured: true,
      promotionEndDate: { $gt: new Date() },
      status: "approved",
    })
      .populate("owner", "name phone email")
      .sort({ promotionStartDate: -1 })
      .limit(10);

    const processed = featured.map((p) => ({
      ...p.toObject(),
      availableUnits: Math.max(0, (p.totalUnits || 1) - (p.bookedUnits || 0)),
    }));

    res.json(processed);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch featured" });
  }
});

// ✅ Cancel Payment
router.post("/cancel/:transactionId", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const payment = user.paymentHistory.find(
      (p) => p.transactionId === req.params.transactionId
    );

    if (!payment) {
      return res.status(404).json({ error: "❌ Payment not found" });
    }

    if (payment.status !== "pending") {
      return res.status(400).json({ error: "❌ Can only cancel pending payments" });
    }

    payment.status = "cancelled";
    await user.save();

    res.json({
      success: true,
      message: "✅ Payment cancelled",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
