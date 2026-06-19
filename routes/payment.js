import express from "express";
import axios from "axios";
import { auth } from "../middleware/auth.js";
import User from "../models/User.js";
import Property from "../models/Property.js";
import Material from "../models/Material.js";
import Config from "../models/Config.js";
import Notification from "../models/Notification.js";

const router = express.Router();

// ====================== M-PESA CONFIGURATION ======================
// Helper function to get M-Pesa configuration from database or environment
const getMpesaConfig = async () => {
  try {
    const shortcode = await Config.getConfig("mpesa_shortcode");
    const accountNumber = await Config.getConfig("mpesa_account_number");
    const passkey = await Config.getConfig("mpesa_passkey");
    const consumerKey = await Config.getConfig("mpesa_consumer_key");
    const consumerSecret = await Config.getConfig("mpesa_consumer_secret");

    return {
      MPESA_SHORTCODE: shortcode || process.env.MPESA_SHORTCODE || "542542",
      MPESA_ACCOUNT_NUMBER: accountNumber || process.env.MPESA_ACCOUNT_NUMBER || "03507214611250",
      MPESA_PASSKEY: passkey || process.env.MPESA_PASSKEY || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919",
      MPESA_CONSUMER_KEY: consumerKey || process.env.MPESA_CONSUMER_KEY,
      MPESA_CONSUMER_SECRET: consumerSecret || process.env.MPESA_CONSUMER_SECRET,
    };
  } catch (err) {
    console.error("Error fetching M-Pesa config:", err);
    return {
      MPESA_SHORTCODE: process.env.MPESA_SHORTCODE || "542542",
      MPESA_ACCOUNT_NUMBER: process.env.MPESA_ACCOUNT_NUMBER || "03507214611250",
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
      "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
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
      AccountReference: config.MPESA_ACCOUNT_NUMBER,
      TransactionDesc: plan || subscriptionType || "Axxspace Payment",
    };

    const mpesaResponse = await axios.post(
      "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
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

        // If payment was for business subscription, activate business subscription
        if (payment.subscriptionType === "business" && payment.businessId) {
          const Business = await import("../models/Business.js").then(m => m.default);
          const BusinessSubscription = await import("../models/BusinessSubscription.js").then(m => m.default);

          const business = await Business.findById(payment.businessId);
          if (business) {
            // Create or update business subscription
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 1); // Default to monthly

            const subscription = new BusinessSubscription({
              business: payment.businessId,
              tier: payment.tier || "bronze",
              status: "active",
              startDate: new Date(),
              endDate,
              paymentMethod: "mpesa",
              transactionId: payment.transactionId,
              amount: payment.amount,
            });

            await subscription.save();

            // Update business with premium features
            if (payment.tier && payment.tier !== "basic") {
              business.isApproved = true;
              business.status = "approved";

              const badgeTypeMap = {
                bronze: "business_verified",
                silver: "premium_verified",
                gold: "premium_verified",
                platinum: "premium_verified"
              };

              const badgeType = badgeTypeMap[payment.tier];
              if (badgeType) {
                const existingBadge = business.verificationBadges.find(b => b.type === badgeType);
                if (!existingBadge) {
                  business.verificationBadges.push({
                    type: badgeType,
                    tier: payment.tier,
                    verifiedAt: Date.now(),
                    verifiedBy: user._id,
                    documents: []
                  });
                }
              }
            }

            await business.save();
          }
        }

        // If payment was for property booking, create booking record
        if (payment.type === "property_booking" && payment.propertyId) {
          const property = await Property.findById(payment.propertyId);
          if (property) {
            user.bookings = user.bookings || [];
            user.bookings.push({
              propertyId: payment.propertyId,
              amount: payment.amount,
              status: "confirmed",
              bookingDate: new Date(),
            });
            property.bookings = property.bookings || [];
            property.bookings.push({
              userId: user._id,
              amount: payment.amount,
              status: "confirmed",
              bookingDate: new Date(),
            });
            await property.save();
          }
        }

        // If payment was for material purchase, create purchase record
        if (payment.type === "material_purchase" && payment.materialId) {
          const material = await Material.findById(payment.materialId);
          if (material) {
            user.purchases = user.purchases || [];
            user.purchases.push({
              materialId: payment.materialId,
              amount: payment.amount,
              status: "confirmed",
              purchaseDate: new Date(),
            });
            material.purchases = material.purchases || [];
            material.purchases.push({
              userId: user._id,
              amount: payment.amount,
              status: "confirmed",
              purchaseDate: new Date(),
            });
            await material.save();
          }
        }

        // If payment was for tourism booking, create booking record
        if (payment.type === "tourism_booking" && payment.tourismId) {
          const TourismListing = await import("../models/TourismListing.js").then(m => m.default);
          const tourism = await TourismListing.findById(payment.tourismId);
          if (tourism) {
            user.tourismBookings = user.tourismBookings || [];
            user.tourismBookings.push({
              tourismId: payment.tourismId,
              amount: payment.amount,
              checkIn: payment.checkIn,
              checkOut: payment.checkOut,
              status: "confirmed",
              bookingDate: new Date(),
            });
            tourism.bookings = tourism.bookings || [];
            tourism.bookings.push({
              userId: user._id,
              amount: payment.amount,
              checkIn: payment.checkIn,
              checkOut: payment.checkOut,
              status: "confirmed",
              bookingDate: new Date(),
            });
            await tourism.save();
          }
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

        // Create notification for admin dashboard
        try {
          const notificationData = {
            type: payment.type,
            userId: user._id,
            userName: user.name,
            userPhone: user.phone,
            userEmail: user.email,
            amount: payment.amount,
            transactionId: payment.transactionId,
            mpesaRef: payment.mpesaRef,
            status: "confirmed",
          };

          if (payment.type === "property_booking") {
            notificationData.propertyId = payment.propertyId;
          } else if (payment.type === "material_purchase") {
            notificationData.materialId = payment.materialId;
          } else if (payment.type === "tourism_booking") {
            notificationData.tourismId = payment.tourismId;
            notificationData.checkIn = payment.checkIn;
            notificationData.checkOut = payment.checkOut;
          }

          const notification = new Notification(notificationData);
          await notification.save();
          console.log("✅ Notification created for admin dashboard");
        } catch (notifError) {
          console.error("❌ Failed to create notification:", notifError);
        }
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

// ====================== PROPERTY BOOKING PAYMENT ======================
router.post("/book-property", auth, async (req, res) => {
  try {
    const { propertyId, phone, amount } = req.body;

    if (!propertyId || !phone || !amount) {
      return res.status(400).json({ error: "❌ Property ID, phone, and amount are required" });
    }

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ error: "❌ Property not found" });
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
      AccountReference: config.MPESA_ACCOUNT_NUMBER,
      TransactionDesc: `Property Booking: ${property.title}`,
    };

    const mpesaResponse = await axios.post(
      "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    await User.findByIdAndUpdate(req.user.id, {
      $push: {
        paymentHistory: {
          transactionId: mpesaResponse.data.CheckoutRequestID,
          amount,
          propertyId,
          status: "pending",
          date: new Date(),
          type: "property_booking",
        },
      },
    });

    res.json({
      success: true,
      message: "✅ M-Pesa prompt sent! Enter PIN on your phone to complete property booking.",
      checkoutRequestID: mpesaResponse.data.CheckoutRequestID,
    });

  } catch (error) {
    console.error("Property Booking Payment Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to initiate property booking payment" });
  }
});

// ====================== MATERIAL PURCHASE PAYMENT ======================
router.post("/purchase-material", auth, async (req, res) => {
  try {
    const { materialId, phone, amount } = req.body;

    if (!materialId || !phone || !amount) {
      return res.status(400).json({ error: "❌ Material ID, phone, and amount are required" });
    }

    const material = await Material.findById(materialId);
    if (!material) {
      return res.status(404).json({ error: "❌ Material not found" });
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
      AccountReference: config.MPESA_ACCOUNT_NUMBER,
      TransactionDesc: `Material Purchase: ${material.title}`,
    };

    const mpesaResponse = await axios.post(
      "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    await User.findByIdAndUpdate(req.user.id, {
      $push: {
        paymentHistory: {
          transactionId: mpesaResponse.data.CheckoutRequestID,
          amount,
          materialId,
          status: "pending",
          date: new Date(),
          type: "material_purchase",
        },
      },
    });

    res.json({
      success: true,
      message: "✅ M-Pesa prompt sent! Enter PIN on your phone to complete material purchase.",
      checkoutRequestID: mpesaResponse.data.CheckoutRequestID,
    });

  } catch (error) {
    console.error("Material Purchase Payment Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to initiate material purchase payment" });
  }
});

// ====================== TOURISM BOOKING PAYMENT ======================
router.post("/book-tourism", auth, async (req, res) => {
  try {
    const { tourismId, phone, amount, checkIn, checkOut } = req.body;

    if (!tourismId || !phone || !amount) {
      return res.status(400).json({ error: "❌ Tourism ID, phone, and amount are required" });
    }

    const TourismListing = await import("../models/TourismListing.js").then(m => m.default);
    const tourism = await TourismListing.findById(tourismId);
    if (!tourism) {
      return res.status(404).json({ error: "❌ Tourism listing not found" });
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
      AccountReference: config.MPESA_ACCOUNT_NUMBER,
      TransactionDesc: `Tourism Booking: ${tourism.name}`,
    };

    const mpesaResponse = await axios.post(
      "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    await User.findByIdAndUpdate(req.user.id, {
      $push: {
        paymentHistory: {
          transactionId: mpesaResponse.data.CheckoutRequestID,
          amount,
          tourismId,
          checkIn,
          checkOut,
          status: "pending",
          date: new Date(),
          type: "tourism_booking",
        },
      },
    });

    res.json({
      success: true,
      message: "✅ M-Pesa prompt sent! Enter PIN on your phone to complete tourism booking.",
      checkoutRequestID: mpesaResponse.data.CheckoutRequestID,
    });

  } catch (error) {
    console.error("Tourism Booking Payment Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to initiate tourism booking payment" });
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

// Get All Featured Listings (Properties, Materials, Tourism)
router.get("/featured-all", async (req, res) => {
  try {
    const [featuredProperties, featuredMaterials, featuredTourism] = await Promise.all([
      Property.find({
        isFeatured: true,
        promotionEndDate: { $gt: new Date() },
        status: "approved",
      })
        .populate("owner", "name phone email")
        .sort({ promotionStartDate: -1 })
        .limit(5),
      Material.find({
        isFeatured: true,
        promotionEndDate: { $gt: new Date() },
        status: "active",
      })
        .populate("seller", "name phone")
        .sort({ promotionStartDate: -1 })
        .limit(5),
      TourismListing.find({
        isFeatured: true,
        promotionEndDate: { $gt: new Date() },
        status: "approved",
      })
        .populate("owner", "name phone email")
        .sort({ promotionStartDate: -1 })
        .limit(5),
    ]);

    const allFeatured = [
      ...featuredProperties.map(p => ({ ...p.toObject(), type: "property" })),
      ...featuredMaterials.map(m => ({ ...m.toObject(), type: "material" })),
      ...featuredTourism.map(t => ({ ...t.toObject(), type: "tourism" })),
    ].sort((a, b) => new Date(b.promotionStartDate) - new Date(a.promotionStartDate));

    res.json(allFeatured);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch featured listings" });
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
      AccountReference: config.MPESA_ACCOUNT_NUMBER,
      TransactionDesc: plan.name,
    };

    const mpesaResponse = await axios.post(
      "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
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
      AccountReference: config.MPESA_ACCOUNT_NUMBER,
      TransactionDesc: boostPlan.name,
    };

    const mpesaResponse = await axios.post(
      "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
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
      AccountReference: config.MPESA_ACCOUNT_NUMBER,
      TransactionDesc: boostPlan.name,
    };

    const mpesaResponse = await axios.post(
      "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
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

// ====================== BANK TRANSFER PAYMENT ENDPOINTS ======================

// Get bank payment information
router.get("/bank-info", async (req, res) => {
  try {
    res.json({
      success: true,
      bankInfo: {
        bankName: process.env.BANK_NAME || "I&M BANK",
        paybill: process.env.BANK_PAYBILL || "542542",
        accountNumber: process.env.BANK_ACCOUNT_NUMBER || "03507214611250",
        instructions: "1. Go to M-Pesa menu\n2. Select Pay Bill\n3. Enter Paybill: 542542\n4. Enter Account Number: 03507214611250\n5. Enter Amount\n6. Enter your M-Pesa PIN\n7. Wait for confirmation SMS"
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch bank information" });
  }
});

// Initiate bank transfer payment
router.post("/bank-transfer", auth, async (req, res) => {
  try {
    const { amount, propertyId, materialId, plan, subscriptionType, transactionRef, bankMessage } = req.body;

    console.log("=== BANK TRANSFER SUBMISSION START ===");
    console.log("User ID:", req.user?.id);
    console.log("User Email:", req.user?.email);
    console.log("Request body:", { amount, propertyId, plan, transactionRef, bankMessage: bankMessage?.substring(0, 50) });

    if (!amount || !transactionRef) {
      console.log("Validation failed: Missing amount or transactionRef");
      return res.status(400).json({ error: "❌ Amount and transaction reference are required" });
    }

    console.log("Validation passed. Saving to database...");

    // Save pending bank transfer transaction
    const updatedUser = await User.findByIdAndUpdate(req.user.id, {
      $push: {
        paymentHistory: {
          transactionId: `BANK-${Date.now()}`,
          amount,
          plan,
          propertyId: propertyId || null,
          materialId: materialId || null,
          subscriptionType: subscriptionType || null,
          status: "pending",
          paymentMethod: "bank_transfer",
          transactionRef,
          bankMessage: bankMessage || "",
          date: new Date(),
        },
      },
    }, { new: true });

    // Create pending notification for admin dashboard review
    try {
      const user = await User.findById(req.user.id);
      await Notification.create({
        type: subscriptionType ? "subscription" : (plan && plan.startsWith("verification-") ? "subscription" : "boost"),
        userId: req.user.id,
        userName: user.name,
        userPhone: user.phone,
        userEmail: user.email,
        amount,
        transactionId: transactionRef,
        mpesaRef: transactionRef,
        status: "pending",
        propertyId: propertyId || undefined,
        materialId: materialId || undefined,
        plan: plan || undefined,
        subscriptionType: subscriptionType || undefined,
        read: false,
      });
      console.log("✅ Pending manual payment notification created for admin");
    } catch (notifErr) {
      console.error("❌ Failed to create pending payment notification:", notifErr);
    }

    console.log("Payment saved successfully. User ID:", req.user.id);
    console.log("Updated paymentHistory count:", updatedUser.paymentHistory.length);
    console.log("=== BANK TRANSFER SUBMISSION END ===");

    res.json({
      success: true,
      message: "✅ Bank transfer payment initiated. Please complete the payment and use your transaction reference for verification.",
      bankInfo: {
        bankName: process.env.BANK_NAME || "I&M BANK",
        paybill: process.env.BANK_PAYBILL || "542542",
        accountNumber: process.env.BANK_ACCOUNT_NUMBER || "03507214611250",
      }
    });

  } catch (error) {
    console.error("=== BANK TRANSFER ERROR ===");
    console.error("Error details:", error.message);
    console.error("Error stack:", error.stack);
    console.error("===============================");
    res.status(500).json({ error: "Failed to initiate bank transfer payment" });
  }
});

// Verify bank transfer payment (Admin only)
router.post("/verify-bank-payment", auth, async (req, res) => {
  try {
    const { transactionRef, userId, approve } = req.body;

    if (!transactionRef || !userId) {
      return res.status(400).json({ error: "❌ Transaction reference and user ID are required" });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "❌ Only admins can verify payments" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "❌ User not found" });
    }

    const payment = user.paymentHistory.find(
      p => p.transactionRef === transactionRef && p.paymentMethod === "bank_transfer"
    );

    if (!payment) {
      return res.status(404).json({ error: "❌ Payment not found" });
    }

    if (approve) {
      payment.status = "success";
      user.walletBalance = (user.walletBalance || 0) + payment.amount;

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

      // If payment was for mover profile boost
      if (!payment.propertyId && !payment.materialId && !payment.subscriptionType && payment.plan && payment.plan.includes("Profile Boost")) {
        user.isFeaturedMover = true;
        user.featuredStartDate = new Date();
        const durationDays = payment.plan.includes("7-Day") ? 7 : 30;
        user.featuredEndDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
      }

      await user.save();
      res.json({ success: true, message: "✅ Payment verified and processed successfully" });
    } else {
      payment.status = "failed";
      await user.save();
      res.json({ success: true, message: "✅ Payment rejected" });
    }

  } catch (error) {
    console.error("Bank Payment Verification Error:", error.message);
    res.status(500).json({ error: "Failed to verify bank payment" });
  }
});

// Get pending bank payments for admin
router.get("/pending-bank-payments", auth, async (req, res) => {
  try {
    console.log("Fetching pending bank payments for admin:", req.user.email);

    if (req.user.role !== "admin") {
      console.log("Access denied: User is not admin");
      return res.status(403).json({ error: "❌ Only admins can view pending payments" });
    }

    const users = await User.find({
      "paymentHistory.paymentMethod": "bank_transfer",
      "paymentHistory.status": "pending"
    }).select("-password");

    console.log("Found users with pending bank payments:", users.length);

    const pendingPayments = [];
    users.forEach(user => {
      user.paymentHistory.forEach(payment => {
        if (payment.paymentMethod === "bank_transfer" && payment.status === "pending") {
          pendingPayments.push({
            ...payment.toObject(),
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
            userPhone: user.phone,
          });
        }
      });
    });

    console.log("Total pending payments found:", pendingPayments.length);

    res.json({ success: true, pendingPayments });
  } catch (err) {
    console.error("Error fetching pending bank payments:", err);
    res.status(500).json({ error: err.message || "Failed to fetch pending payments" });
  }
});

// Get notifications for admin dashboard
router.get("/notifications", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "❌ Only admins can view notifications" });
    }

    const notifications = await Notification.find()
      .populate("userId", "name phone email")
      .populate("propertyId", "title")
      .populate("materialId", "title")
      .populate("tourismId", "title")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch notifications" });
  }
});
// Mark notification as read / approve manual payment
router.put("/notifications/:id/read", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "❌ Only admins can update notifications" });
    }

    const { approve } = req.body;
    console.log(`=== PROCESS MANUAL PAYMENT START ===`);
    console.log(`Notification ID:`, req.params.id);
    console.log(`Approve state:`, approve);

    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ error: "❌ Notification not found" });
    }

    notification.read = true;

    // Process manual bank transfer payments if notification is pending
    if (notification.status === "pending") {
      const isApproved = approve !== false; // Default to true if not specified
      console.log(`Pending notification found. Action:`, isApproved ? "APPROVE" : "REJECT");

      const user = await User.findById(notification.userId);
      if (user) {
        // Find payment in payment history by transaction reference matching transactionId/mpesaRef
        const payment = user.paymentHistory.find(
          p => (p.transactionRef === notification.transactionId || p.transactionRef === notification.mpesaRef) && p.paymentMethod === "bank_transfer"
        );

        if (payment) {
          console.log(`Found matching paymentHistory item:`, payment.transactionId);
          if (isApproved) {
            payment.status = "success";
            user.walletBalance = (user.walletBalance || 0) + (payment.amount || notification.amount || 0);
            notification.status = "confirmed";

            // 1. If property boost
            if (payment.propertyId) {
              const property = await Property.findById(payment.propertyId);
              if (property) {
                property.isFeatured = true;
                property.promotionStartDate = new Date();
                const durationDays = payment.plan === "boost-7days" ? 7 : 30;
                property.promotionEndDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
                property.promotionTier = payment.plan;
                await property.save();
                console.log(`Activated featured boost for property:`, property.title);
              }
            }

            // 2. If material boost
            if (payment.materialId) {
              const material = await Material.findById(payment.materialId);
              if (material) {
                material.isFeatured = true;
                material.promotionStartDate = new Date();
                const durationDays = payment.plan === "boost-7days" ? 7 : 30;
                material.promotionEndDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
                material.promotionTier = payment.plan;
                await material.save();
                console.log(`Activated featured boost for material:`, material.title);
              }
            }

            // 3. If subscription
            if (payment.subscriptionType && !payment.plan?.startsWith("verification-")) {
              const durationDays = payment.subscriptionType === "basic" ? 30 : 90;
              user.subscriptionTier = payment.subscriptionType;
              user.subscriptionStartDate = new Date();
              user.subscriptionEndDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
              console.log(`Upgraded user subscription tier to:`, payment.subscriptionType);
            }

            // 4. If verification badge subscription
            if (payment.plan && payment.plan.startsWith("verification-")) {
              const badgeType = payment.subscriptionType; // e.g. student_verified, online_verified, etc.
              if (badgeType) {
                if (!user.verificationBadges.includes(badgeType)) {
                  user.verificationBadges.push(badgeType);
                }
                // Map badgeType to status fields
                if (badgeType === "student_verified") {
                  user.studentVerificationStatus = "approved";
                } else if (badgeType === "premium_verified") {
                  user.premiumVerificationStatus = "approved";
                } else {
                  user.standardVerificationStatus = "approved";
                }
                user.verificationStatus = "approved";
                console.log(`Awarded verification badge:`, badgeType);
              }
            }

            // 5. If mover profile boost
            if (!payment.propertyId && !payment.materialId && !payment.subscriptionType && payment.plan && payment.plan.includes("Profile Boost")) {
              user.isFeaturedMover = true;
              user.featuredStartDate = new Date();
              const durationDays = payment.plan.includes("7-Day") ? 7 : 30;
              user.featuredEndDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
              console.log(`Activated mover profile boost`);
            }
          } else {
            // Rejected
            payment.status = "failed";
            notification.status = "rejected";
            console.log(`Payment status set to failed`);
          }
          await user.save();
          console.log(`Saved user status successfully`);
        } else {
          console.log(`❌ No matching paymentHistory item found in user profile`);
        }
      } else {
        console.log(`❌ User with ID ${notification.userId} not found`);
      }
    }

    await notification.save();
    console.log(`=== PROCESS MANUAL PAYMENT END ===`);
    res.json({ success: true, notification });
  } catch (err) {
    console.error("❌ Process notification error:", err);
    res.status(500).json({ error: err.message || "Failed to update notification" });
  }
});

// ====================== AXXWALLET ROUTES ======================

// Withdraw funds from wallet
router.post("/withdraw", auth, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount < 100) {
      return res.status(400).json({ error: "❌ Minimum withdrawal is KES 100" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "❌ User not found" });
    }

    if (user.walletBalance < amount) {
      return res.status(400).json({ error: "❌ Insufficient wallet balance" });
    }

    // Deduct from wallet balance
    user.walletBalance -= amount;

    // Add to payment history
    user.paymentHistory.push({
      transactionId: `WTH-${Date.now()}`,
      amount,
      plan: "Wallet Withdrawal",
      status: "pending",
      date: new Date(),
      type: "withdrawal",
    });

    await user.save();

    res.json({
      success: true,
      message: "✅ Withdrawal request submitted. Funds will be transferred to your M-Pesa account within 24 hours.",
      balance: user.walletBalance,
    });
  } catch (error) {
    console.error("Withdrawal Error:", error.message);
    res.status(500).json({ error: "Failed to process withdrawal" });
  }
});

// Transfer funds to another user
router.post("/transfer", auth, async (req, res) => {
  try {
    const { amount, recipientPhone } = req.body;

    if (!amount || amount < 10) {
      return res.status(400).json({ error: "❌ Minimum transfer is KES 10" });
    }

    if (!recipientPhone) {
      return res.status(400).json({ error: "❌ Recipient phone number is required" });
    }

    const sender = await User.findById(req.user.id);
    if (!sender) {
      return res.status(404).json({ error: "❌ Sender not found" });
    }

    if (sender.walletBalance < amount) {
      return res.status(400).json({ error: "❌ Insufficient wallet balance" });
    }

    // Find recipient by phone, prioritizing role: "user", then "landlord", then "mover", then "seller"
    let recipient = await User.findOne({ phone: recipientPhone, role: "user" });
    if (!recipient) {
      recipient = await User.findOne({ phone: recipientPhone, role: "landlord" });
    }
    if (!recipient) {
      recipient = await User.findOne({ phone: recipientPhone, role: "mover" });
    }
    if (!recipient) {
      recipient = await User.findOne({ phone: recipientPhone, role: "seller" });
    }
    if (!recipient) {
      recipient = await User.findOne({ phone: recipientPhone });
    }
    if (!recipient) {
      return res.status(404).json({ error: "❌ Recipient not found" });
    }

    if (recipient._id.toString() === sender._id.toString()) {
      return res.status(400).json({ error: "❌ Cannot transfer to yourself" });
    }

    // Perform transfer
    sender.walletBalance -= amount;
    recipient.walletBalance += amount;

    const transactionId = `TRF-${Date.now()}`;

    // Add to sender's payment history
    sender.paymentHistory.push({
      transactionId,
      amount,
      plan: "Wallet Transfer",
      status: "success",
      date: new Date(),
      type: "transfer_sent",
      recipientPhone: recipientPhone,
      recipientName: recipient.name,
    });

    // Add to recipient's payment history
    recipient.paymentHistory.push({
      transactionId,
      amount,
      plan: "Wallet Transfer Received",
      status: "success",
      date: new Date(),
      type: "transfer_received",
      senderPhone: sender.phone,
      senderName: sender.name,
    });

    await sender.save();
    await recipient.save();

    res.json({
      success: true,
      message: `✅ KES ${amount} transferred successfully to ${recipient.name}`,
      balance: sender.walletBalance,
    });
  } catch (error) {
    console.error("Transfer Error:", error.message);
    res.status(500).json({ error: "Failed to process transfer" });
  }
});

// Get wallet statistics
router.get("/wallet-stats", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "❌ User not found" });
    }

    const transactions = user.paymentHistory || [];
    const successfulTransactions = transactions.filter(t => t.status === "success");
    const totalSpent = successfulTransactions
      .filter(t => t.type !== "transfer_received")
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalReceived = successfulTransactions
      .filter(t => t.type === "transfer_received")
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    // Calculate this month's transactions
    const now = new Date();
    const thisMonthTransactions = successfulTransactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    });
    const thisMonthTotal = thisMonthTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    res.json({
      success: true,
      stats: {
        balance: user.walletBalance || 0,
        totalTransactions: transactions.length,
        successfulTransactions: successfulTransactions.length,
        successRate: transactions.length > 0 ? Math.round((successfulTransactions.length / transactions.length) * 100) : 0,
        totalSpent,
        totalReceived,
        thisMonthTotal,
        averageTransaction: successfulTransactions.length > 0 ? Math.round(totalSpent / successfulTransactions.length) : 0,
      },
    });
  } catch (error) {
    console.error("Wallet Stats Error:", error.message);
    res.status(500).json({ error: "Failed to fetch wallet statistics" });
  }
});

export default router;