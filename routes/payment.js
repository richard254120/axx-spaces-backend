import express from "express";
import axios from "axios";
import { auth } from "../middleware/auth.js";
import User from "../models/User.js";
import Property from "../models/Property.js";

const router = express.Router();

// ====================== M-PESA CONFIGURATION ======================
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE || "174379";
const MPESA_PASSKEY = process.env.MPESA_PASSKEY || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";

/**
 * Generates the M-Pesa Access Token
 */
const getAccessToken = async () => {
  try {
    const authString = Buffer.from(
      `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString("base64");

    const response = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      { headers: { Authorization: `Basic ${authString}` } }
    );
    return response.data.access_token;
  } catch (error) {
    console.error("Access Token Error:", error.response?.data || error.message);
    throw new Error("Failed to authenticate with M-Pesa");
  }
};

// ====================== M-PESA STK PUSH (Renamed to match your frontend) ======================
router.post("/initiate-mpesa", auth, async (req, res) => {
  try {
    const { phone, amount, propertyId, plan } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({ error: "❌ Phone and amount are required" });
    }

    // Format phone to 254XXXXXXXXX
    let formattedPhone = phone.toString().replace(/\D/g, "");
    if (formattedPhone.startsWith("0")) formattedPhone = "254" + formattedPhone.substring(1);
    if (!formattedPhone.startsWith("254")) formattedPhone = "254" + formattedPhone;

    const token = await getAccessToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
    const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString("base64");

    const payload = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(Number(amount)),
      PartyA: formattedPhone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: formattedPhone,
      CallBackURL: `${process.env.BACKEND_URL}/api/payment/callback`, 
      AccountReference: `AX${propertyId || "Wallet"}`,
      TransactionDesc: plan || "Axx Spaces Payment",
    };

    const mpesaResponse = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // Save initial pending transaction using CheckoutRequestID
    await User.findByIdAndUpdate(req.user.id, {
      $push: {
        paymentHistory: {
          transactionId: mpesaResponse.data.CheckoutRequestID,
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
      message: "✅ M-Pesa prompt sent! Enter PIN 123456.",
      checkoutRequestID: mpesaResponse.data.CheckoutRequestID
    });

  } catch (error) {
    console.error("STK Push Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to send M-Pesa prompt" });
  }
});

// ====================== CALLBACK ROUTE ======================
router.post("/callback", async (req, res) => {
  try {
    const { Body } = req.body;
    if (!Body?.stkCallback) return res.status(400).send("Invalid Callback");

    const { ResultCode, ResultDesc, CheckoutRequestID, CallbackMetadata } = Body.stkCallback;

    if (ResultCode === 0) {
      const amount = CallbackMetadata.Item.find(item => item.Name === 'Amount').Value;
      const receipt = CallbackMetadata.Item.find(item => item.Name === 'MpesaReceiptNumber').Value;

      const user = await User.findOne({ "paymentHistory.transactionId": CheckoutRequestID });

      if (user) {
        const payment = user.paymentHistory.find(p => p.transactionId === CheckoutRequestID);
        payment.status = "success";
        payment.mpesaReceipt = receipt;
        user.walletBalance = (user.walletBalance || 0) + amount;

        if (payment.propertyId) {
          const property = await Property.findById(payment.propertyId);
          if (property) {
            property.isFeatured = true;
            property.promotionStartDate = new Date();
            const durationDays = payment.plan === "boost-7days" ? 7 : 30;
            property.promotionEndDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
            property.promotionTier = payment.plan;
            await property.save();
          }
        }
        await user.save();
      }
    } else {
      await User.updateOne(
        { "paymentHistory.transactionId": CheckoutRequestID },
        { $set: { "paymentHistory.$.status": "failed" } }
      );
    }
    res.status(200).json("Success");
  } catch (err) {
    console.error("❌ Callback Processing Error:", err);
    res.status(500).json("Error");
  }
});

// ====================== ORIGINAL UTILITY ROUTES ======================

router.get("/wallet", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      success: true,
      balance: user.walletBalance || 0,
      paymentHistory: user.paymentHistory || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

    res.json(featured);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/cancel/:transactionId", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const payment = user.paymentHistory.find(p => p.transactionId === req.params.transactionId);
    if (!payment || payment.status !== "pending") return res.status(400).json({ error: "Invalid request" });

    payment.status = "cancelled";
    await user.save();
    res.json({ success: true, message: "✅ Cancelled" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;