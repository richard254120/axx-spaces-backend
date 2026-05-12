import express from "express";
import axios from "axios";
import { auth } from "../middleware/auth.js";
import User from "../models/User.js";
import Property from "../models/Property.js";

const router = express.Router();

// ====================== SANDBOX M-PESA CONFIG (FOR TESTING) ======================
const MPESA_SHORTCODE = "174379";
const MPESA_PASSKEY = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";

// Get M-Pesa Access Token
const getAccessToken = async () => {
  const authString = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString("base64");

  const response = await axios.get(
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    { headers: { Authorization: `Basic ${authString}` } }
  );
  return response.data.access_token;
};

// ====================== STK PUSH - FOR TESTING ======================
router.post("/stkpush", auth, async (req, res) => {
  try {
    const { phone, amount, propertyId, plan } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({ error: "❌ Phone and amount are required" });
    }

    const token = await getAccessToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
    const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString("base64");

    const payload = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerBuyGoodsOnline",
      Amount: Math.round(Number(amount)),
      PartyA: phone.replace(/\s+/g, ""),
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: phone.replace(/\s+/g, ""),
      CallBackURL: "https://yourdomain.com/api/payment/callback",
      AccountReference: `AX${propertyId || Date.now()}`,
      TransactionDesc: plan || "Axx Spaces Test Payment",
    };

    const mpesaResponse = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json({
      success: true,
      message: "✅ Test M-Pesa prompt sent! Use phone 254708374149 and PIN 123456",
      checkoutRequestID: mpesaResponse.data.CheckoutRequestID
    });

  } catch (error) {
    console.error("STK Push Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to send M-Pesa prompt" });
  }
});

// ====================== YOUR ORIGINAL ROUTES ======================

// Initiate Mpesa Payment
router.post("/initiate-mpesa", auth, async (req, res) => {
  try {
    const { phone, amount, propertyId, plan } = req.body;

    console.log("💳 Payment initiated:", { phone, amount, plan, propertyId });

    if (!phone || !amount) {
      return res.status(400).json({ error: "❌ Phone and amount required" });
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

// Verify Mpesa Payment
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
        const durationDays = payment.plan === "boost-7days" ? 7 : 30;
        property.promotionEndDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
        property.promotionTier = payment.plan;
        await property.save();
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

// Get Wallet Balance
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

// Get Featured Properties
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

// Cancel Payment
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