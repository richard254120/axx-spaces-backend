import express from "express";
import axios from "axios";
import { auth } from "../middleware/auth.js";
import User from "../models/User.js";
import Property from "../models/Property.js";
import Material from "../models/Material.js";
import Config from "../models/Config.js";

const router = express.Router();

// ====================== M-PESA CONFIGURATION ======================
// Helper function to get M-Pesa configuration from database or environment
const getMpesaConfig = async () => {
  try {
    const shortcode = await Config.getConfig("mpesa_shortcode");
    const passkey = await Config.getConfig("mpesa_passkey");
    const consumerKey = await Config.getConfig("mpesa_consumer_key");
    const consumerSecret = await Config.getConfig("mpesa_consumer_secret");
    
    return {
      MPESA_SHORTCODE: shortcode || process.env.MPESA_SHORTCODE || "174379",
      MPESA_PASSKEY: passkey || process.env.MPESA_PASSKEY || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919",
      MPESA_CONSUMER_KEY: consumerKey || process.env.MPESA_CONSUMER_KEY,
      MPESA_CONSUMER_SECRET: consumerSecret || process.env.MPESA_CONSUMER_SECRET,
    };
  } catch (err) {
    console.error("Error fetching M-Pesa config:", err);
    return {
      MPESA_SHORTCODE: process.env.MPESA_SHORTCODE || "174379",
      MPESA_PASSKEY: process.env.MPESA_PASSKEY || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919",
      MPESA_CONSUMER_KEY: process.env.MPESA_CONSUMER_KEY,
      MPESA_CONSUMER_SECRET: process.env.MPESA_CONSUMER_SECRET,
    };
  }
};

/**
 * Generates the M-Pesa Access Token using Consumer Key and Secret
 */
const getAccessToken = async () => {
  try {
    const config = await getMpesaConfig();
    const authString = Buffer.from(
      `${config.MPESA_CONSUMER_KEY}:${config.MPESA_CONSUMER_SECRET}`
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

// ====================== NEW: STK PUSH (INITIATION) ======================
router.post("/initiate-mpesa", auth, async (req, res) => {
  try {
    const { phone, amount, propertyId, materialId, plan, subscriptionType } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({ error: "❌ Phone and amount are required" });
    }

    const token = await getAccessToken();
    const config = await getMpesaConfig();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
    const password = Buffer.from(`${config.MPESA_SHORTCODE}${config.MPESA_PASSKEY}${timestamp}`).toString("base64");

    const payload = {
      BusinessShortCode: config.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(Number(amount)),
      PartyA: phone.replace(/\s+/g, ""),
      PartyB: config.MPESA_SHORTCODE,
      PhoneNumber: phone.replace(/\s+/g, ""),
      CallBackURL: `${process.env.BACKEND_URL}/api/payment/callback`,
      AccountReference: `AX${propertyId || materialId || subscriptionType || "Wallet"}`,
      TransactionDesc: plan || subscriptionType || "Axxspace Payment",
    };

    const mpesaResponse = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // Save initial pending transaction to history
    await User.findByIdAndUpdate(req.user.id, {
      $push: {
        paymentHistory: {
          transactionId: mpesaResponse.data.CheckoutRequestID,
          amount,
          plan,
          propertyId: propertyId || null,
          materialId: materialId || null,
          subscriptionType: subscriptionType || null,
          status: "pending",
          date: new Date(),
        },
      },
    });

    res.json({
      success: true,
      message: "✅ M-Pesa prompt sent! Enter PIN 123456 on your phone.",
      checkoutRequestID: mpesaResponse.data.CheckoutRequestID
    });

  } catch (error) {
    console.error("STK Push Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to send M-Pesa prompt" });
  }
});

// ====================== NEW: CALLBACK ROUTE (DATABASE UPDATES) ======================
router.post("/callback", async (req, res) => {
  try {
    const { Body } = req.body;
    if (!Body.stkCallback) return res.status(400).send("Invalid Callback");

    const { ResultCode, ResultDesc, CheckoutRequestID, CallbackMetadata } = Body.stkCallback;

    console.log(`📩 M-Pesa Callback: ${CheckoutRequestID} - ${ResultDesc}`);

    if (ResultCode === 0) {
      // Extract payment details from metadata
      const amount = CallbackMetadata.Item.find(item => item.Name === 'Amount').Value;
      const receipt = CallbackMetadata.Item.find(item => item.Name === 'MpesaReceiptNumber').Value;

      // Find the user with the matching CheckoutRequestID
      const user = await User.findOne({ "paymentHistory.transactionId": CheckoutRequestID });

      if (user) {
        const payment = user.paymentHistory.find(p => p.transactionId === CheckoutRequestID);
        
        payment.status = "success";
        payment.mpesaReceipt = receipt;
        user.walletBalance = (user.walletBalance || 0) + amount;

        // If payment was for a property boost, update the property
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

        // If payment was for a material boost, update the material
        if (payment.materialId) {
          const material = await Material.findById(payment.materialId);
          if (material) {
            material.isFeatured = true;
            material.promotionStartDate = new Date();
            const durationDays = payment.plan === "boost-7days" ? 7 : 30;
            material.promotionEndDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
            material.promotionTier = payment.plan;
            await material.save();
          }
        }

        // If payment was for a subscription, update user subscription
        if (payment.subscriptionType) {
          const durationDays = payment.subscriptionType === "basic" ? 30 : 90;
          user.subscriptionTier = payment.subscriptionType;
          user.subscriptionStartDate = new Date();
          user.subscriptionEndDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
        }

        // If payment was for mover profile boost (no materialId, no propertyId, no subscriptionType)
        if (!payment.propertyId && !payment.materialId && !payment.subscriptionType && payment.plan && payment.plan.includes("Profile Boost")) {
          user.isFeaturedMover = true;
          user.featuredStartDate = new Date();
          const durationDays = payment.plan.includes("7-Day") ? 7 : 30;
          user.featuredEndDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
        }

        await user.save();
        console.log("✅ Database updated: Payment Successful");
      }
    } else {
      // Mark as failed in DB
      await User.updateOne(
        { "paymentHistory.transactionId": CheckoutRequestID },
        { $set: { "paymentHistory.$.status": "failed" } }
      );
      console.log("❌ Payment Failed/Cancelled by User");
    }

    res.status(200).json("Success");
  } catch (err) {
    console.error("❌ Callback Processing Error:", err);
    res.status(500).json("Error");
  }
});

// ====================== ORIGINAL ROUTES ======================

// Get Wallet Balance & History
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

// Get Featured Properties (Sorted by newest promotion)
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

// Cancel a Pending Payment Manually
router.post("/cancel/:transactionId", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const payment = user.paymentHistory.find(
      (p) => p.transactionId === req.params.transactionId
    );

    if (!payment) return res.status(404).json({ error: "❌ Payment not found" });
    if (payment.status !== "pending") return res.status(400).json({ error: "❌ Only pending payments can be cancelled" });

    payment.status = "cancelled";
    await user.save();

    res.json({ success: true, message: "✅ Payment marked as cancelled" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================== SUBSCRIPTION ENDPOINTS ======================

// Get subscription info for current user
router.get("/subscription", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const now = new Date();
    
    // Check if subscription is still active
    const isActive = user.subscriptionEndDate && user.subscriptionEndDate > now;
    
    res.json({
      subscriptionTier: user.subscriptionTier,
      subscriptionStartDate: user.subscriptionStartDate,
      subscriptionEndDate: user.subscriptionEndDate,
      isActive,
      daysRemaining: isActive ? Math.ceil((user.subscriptionEndDate - now) / (1000 * 60 * 60 * 24)) : 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Purchase subscription for movers or sellers
router.post("/subscribe", auth, async (req, res) => {
  try {
    const { subscriptionType, phone } = req.body;
    
    if (!subscriptionType || !phone) {
      return res.status(400).json({ error: "❌ Subscription type and phone are required" });
    }

    if (req.user.role !== "mover" && req.user.role !== "seller") {
      return res.status(403).json({ error: "❌ Only movers and sellers can purchase subscriptions" });
    }

    // Define subscription pricing
    const pricing = {
      basic: { amount: 500, duration: 30, name: "Basic Plan (30 days)" },
      premium: { amount: 1200, duration: 90, name: "Premium Plan (90 days)" },
    };

    const plan = pricing[subscriptionType];
    if (!plan) {
      return res.status(400).json({ error: "❌ Invalid subscription type" });
    }

    const token = await getAccessToken();
    const config = await getMpesaConfig();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
    const password = Buffer.from(`${config.MPESA_SHORTCODE}${config.MPESA_PASSKEY}${timestamp}`).toString("base64");

    const payload = {
      BusinessShortCode: config.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: plan.amount,
      PartyA: phone.replace(/\s+/g, ""),
      PartyB: config.MPESA_SHORTCODE,
      PhoneNumber: phone.replace(/\s+/g, ""),
      CallBackURL: `${process.env.BACKEND_URL}/api/payment/callback`,
      AccountReference: `AXX-${subscriptionType}-${req.user.role}`,
      TransactionDesc: plan.name,
    };

    const mpesaResponse = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // Save initial pending transaction to history
    await User.findByIdAndUpdate(req.user.id, {
      $push: {
        paymentHistory: {
          transactionId: mpesaResponse.data.CheckoutRequestID,
          amount: plan.amount,
          plan: plan.name,
          subscriptionType,
          status: "pending",
          date: new Date(),
        },
      },
    });

    res.json({
      success: true,
      message: `✅ M-Pesa prompt sent for ${plan.name}! Enter PIN on your phone.`,
      checkoutRequestID: mpesaResponse.data.CheckoutRequestID,
      plan: plan.name,
      amount: plan.amount,
    });

  } catch (error) {
    console.error("Subscription Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to initiate subscription payment" });
  }
});

// Boost material listing
router.post("/boost-material", auth, async (req, res) => {
  try {
    const { materialId, plan, phone } = req.body;
    
    if (!materialId || !plan || !phone) {
      return res.status(400).json({ error: "❌ Material ID, plan, and phone are required" });
    }

    if (req.user.role !== "seller") {
      return res.status(403).json({ error: "❌ Only sellers can boost materials" });
    }

    // Verify ownership
    const material = await Material.findById(materialId);
    if (!material || material.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "❌ You can only boost your own materials" });
    }

    // Define boost pricing
    const pricing = {
      "boost-7days": { amount: 200, duration: 7, name: "7-Day Boost" },
      "boost-30days": { amount: 500, duration: 30, name: "30-Day Boost" },
    };

    const boostPlan = pricing[plan];
    if (!boostPlan) {
      return res.status(400).json({ error: "❌ Invalid boost plan" });
    }

    const token = await getAccessToken();
    const config = await getMpesaConfig();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
    const password = Buffer.from(`${config.MPESA_SHORTCODE}${config.MPESA_PASSKEY}${timestamp}`).toString("base64");

    const payload = {
      BusinessShortCode: config.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: boostPlan.amount,
      PartyA: phone.replace(/\s+/g, ""),
      PartyB: config.MPESA_SHORTCODE,
      PhoneNumber: phone.replace(/\s+/g, ""),
      CallBackURL: `${process.env.BACKEND_URL}/api/payment/callback`,
      AccountReference: `AXX-Material-${materialId}`,
      TransactionDesc: boostPlan.name,
    };

    const mpesaResponse = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // Save initial pending transaction to history
    await User.findByIdAndUpdate(req.user.id, {
      $push: {
        paymentHistory: {
          transactionId: mpesaResponse.data.CheckoutRequestID,
          amount: boostPlan.amount,
          plan: boostPlan.name,
          materialId,
          status: "pending",
          date: new Date(),
        },
      },
    });

    res.json({
      success: true,
      message: `✅ M-Pesa prompt sent for ${boostPlan.name}! Enter PIN on your phone.`,
      checkoutRequestID: mpesaResponse.data.CheckoutRequestID,
      plan: boostPlan.name,
      amount: boostPlan.amount,
    });

  } catch (error) {
    console.error("Material Boost Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to initiate material boost payment" });
  }
});

// Boost mover profile
router.post("/boost-mover", auth, async (req, res) => {
  try {
    const { plan, phone } = req.body;
    
    if (!plan || !phone) {
      return res.status(400).json({ error: "❌ Plan and phone are required" });
    }

    if (req.user.role !== "mover") {
      return res.status(403).json({ error: "❌ Only movers can boost their profile" });
    }

    // Define boost pricing
    const pricing = {
      "boost-7days": { amount: 300, duration: 7, name: "7-Day Profile Boost" },
      "boost-30days": { amount: 700, duration: 30, name: "30-Day Profile Boost" },
    };

    const boostPlan = pricing[plan];
    if (!boostPlan) {
      return res.status(400).json({ error: "❌ Invalid boost plan" });
    }

    const token = await getAccessToken();
    const config = await getMpesaConfig();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
    const password = Buffer.from(`${config.MPESA_SHORTCODE}${config.MPESA_PASSKEY}${timestamp}`).toString("base64");

    const payload = {
      BusinessShortCode: config.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: boostPlan.amount,
      PartyA: phone.replace(/\s+/g, ""),
      PartyB: config.MPESA_SHORTCODE,
      PhoneNumber: phone.replace(/\s+/g, ""),
      CallBackURL: `${process.env.BACKEND_URL}/api/payment/callback`,
      AccountReference: `AXX-Mover-${req.user._id}`,
      TransactionDesc: boostPlan.name,
    };

    const mpesaResponse = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // Save initial pending transaction to history
    await User.findByIdAndUpdate(req.user.id, {
      $push: {
        paymentHistory: {
          transactionId: mpesaResponse.data.CheckoutRequestID,
          amount: boostPlan.amount,
          plan: boostPlan.name,
          status: "pending",
          date: new Date(),
        },
      },
    });

    res.json({
      success: true,
      message: `✅ M-Pesa prompt sent for ${boostPlan.name}! Enter PIN on your phone.`,
      checkoutRequestID: mpesaResponse.data.CheckoutRequestID,
      plan: boostPlan.name,
      amount: boostPlan.amount,
    });

  } catch (error) {
    console.error("Mover Boost Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to initiate mover profile boost payment" });
  }
});

// Get featured materials
router.get("/featured-materials", async (req, res) => {
  try {
    const featured = await Material.find({
      isFeatured: true,
      promotionEndDate: { $gt: new Date() },
      status: "approved",
    })
      .populate("seller", "name phone")
      .sort({ promotionStartDate: -1 })
      .limit(10);

    res.json(featured);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch featured materials" });
  }
});

// Get featured movers
router.get("/featured-movers", async (req, res) => {
  try {
    const featured = await User.find({
      role: "mover",
      isApproved: true,
      isFeaturedMover: true,
      featuredEndDate: { $gt: new Date() },
    })
      .select("-password")
      .sort({ featuredStartDate: -1 })
      .limit(10);

    res.json(featured);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch featured movers" });
  }
});

export default router;