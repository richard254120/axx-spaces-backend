import express from "express";
import ItemRequest from "../models/ItemRequest.js";
import { protect, adminOnly } from "../middleware/auth.js";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { sendItemRequestEmail } from "../utils/email.js";
import Notification from "../models/Notification.js";

const router = express.Router();

// Helper to optionally get user if token is present
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId || decoded.id);
      if (user) {
        req.user = user;
      }
    }
  } catch (err) {
    // Ignore invalid token and treat as guest
  }
  next();
};

// Create a new request
router.post("/", optionalAuth, async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      serviceType,
      searchQuery,
      details,
      targetLocation,
      pickupLocation,
      dropoffLocation,
      budgetMin,
      budgetMax,
      budgetCurrency,
      budgetPeriod,
      urgency,
      preferredContact,
      categorySpecifics
    } = req.body;

    // Check if user is an actual authenticated account, NOT an anonymous guest
    const isRealUser = req.user && req.user.role !== "guest" && !req.user.name?.toLowerCase().startsWith("guest_");

    // Prioritize explicitly submitted form values over guest auth session
    const finalName = (name && name.trim()) || (isRealUser ? req.user.name : "") || "Client";
    const finalEmail = (email && email.trim()) || (isRealUser ? req.user.email : "");
    const finalPhone = (phone && phone.trim()) || (isRealUser ? req.user.phone : "");

    if (!finalEmail || !searchQuery || !details) {
      return res.status(400).json({ error: "Email, item / service requested, and details are required." });
    }

    const itemRequest = new ItemRequest({
      user: isRealUser ? req.user._id : undefined,
      name: finalName,
      email: finalEmail,
      phone: finalPhone,
      serviceType: serviceType || "other",
      searchQuery: searchQuery.trim(),
      details: details.trim(),
      targetLocation: targetLocation?.trim() || "",
      pickupLocation: pickupLocation?.trim() || "",
      dropoffLocation: dropoffLocation?.trim() || "",
      budgetMin: budgetMin ? Number(budgetMin) : null,
      budgetMax: budgetMax ? Number(budgetMax) : null,
      budgetCurrency: budgetCurrency || "KES",
      budgetPeriod: budgetPeriod || "total",
      urgency: urgency || "flexible",
      preferredContact: preferredContact || "whatsapp",
      categorySpecifics: categorySpecifics || {}
    });

    await itemRequest.save();

    // Send email notification to admin
    try {
      await sendItemRequestEmail(itemRequest);
    } catch (emailError) {
      console.error("Failed to send email notification:", emailError);
    }

    // Create notification for all admin users
    try {
      const admins = await User.find({ role: "admin" });
      for (const admin of admins) {
        await Notification.create({
          type: "item_request",
          userId: admin._id,
          userName: itemRequest.name,
          userEmail: itemRequest.email,
          userPhone: itemRequest.phone,
          status: "pending",
        });
      }
    } catch (notificationError) {
      console.error("Failed to create notification:", notificationError);
    }

    res.status(201).json({ success: true, message: "Request submitted successfully. Admin has been notified.", request: itemRequest });
  } catch (error) {
    console.error(" Submit request error:", error);
    res.status(500).json({ error: error.message || "Failed to submit request" });
  }
});

// Admin: Get all requests
router.get("/admin", protect, adminOnly, async (req, res) => {
  try {
    const requests = await ItemRequest.find()
      .populate("user", "name email phone")
      .sort({ createdAt: -1 });

    res.json({ success: true, requests });
  } catch (error) {
    console.error(" Get admin requests error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch requests" });
  }
});

// Admin: Update request status
router.patch("/admin/:id/status", protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "contacted", "resolved"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value." });
    }

    const request = await ItemRequest.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate("user", "name email phone");

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    res.json({ success: true, message: `Request status updated to ${status}`, request });
  } catch (error) {
    console.error(" Update request status error:", error);
    res.status(500).json({ error: error.message || "Failed to update status" });
  }
});

export default router;
