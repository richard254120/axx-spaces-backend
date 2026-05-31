import express from "express";
import { auth } from "../middleware/auth.js";
import BusinessInquiry from "../models/BusinessInquiry.js";
import Business from "../models/Business.js";

const router = express.Router();

// ====================== GET INQUIRIES FOR A BUSINESS ======================
router.get("/business/:businessId", auth, async (req, res) => {
  try {
    const { businessId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    const filter = { business: businessId };
    if (status) filter.status = status;

    // Check if user owns the business
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    if (business.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to view these inquiries" });
    }

    const inquiries = await BusinessInquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await BusinessInquiry.countDocuments(filter);

    res.json({
      success: true,
      inquiries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get business inquiries error:", error);
    res.status(500).json({ error: "Failed to fetch inquiries" });
  }
});

// ====================== GET USER'S INQUIRIES ======================
router.get("/my", auth, async (req, res) => {
  try {
    const inquiries = await BusinessInquiry.find({ user: req.user.id })
      .populate("business", "name")
      .sort({ createdAt: -1 });

    res.json({ success: true, inquiries });
  } catch (error) {
    console.error("Get user inquiries error:", error);
    res.status(500).json({ error: "Failed to fetch your inquiries" });
  }
});

// ====================== CREATE INQUIRY ======================
router.post("/business/:businessId", async (req, res) => {
  try {
    const { businessId } = req.params;
    const { name, email, phone, subject, message, preferredContact } = req.body;

    // Check if business exists
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    const inquiry = new BusinessInquiry({
      business: businessId,
      user: req.user?.id || null,
      name,
      email,
      phone,
      subject,
      message,
      preferredContact: preferredContact || "email",
    });

    await inquiry.save();

    res.json({ success: true, message: "Inquiry sent successfully", inquiry });
  } catch (error) {
    console.error("Create inquiry error:", error);
    res.status(500).json({ error: "Failed to send inquiry" });
  }
});

// ====================== RESPOND TO INQUIRY ======================
router.put("/:inquiryId/respond", auth, async (req, res) => {
  try {
    const inquiry = await BusinessInquiry.findById(req.params.inquiryId);

    if (!inquiry) {
      return res.status(404).json({ error: "Inquiry not found" });
    }

    // Check if user owns the business
    const business = await Business.findById(inquiry.business);
    if (business.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to respond to this inquiry" });
    }

    const { response } = req.body;

    inquiry.response = response;
    inquiry.status = "responded";
    inquiry.respondedAt = Date.now();

    await inquiry.save();

    res.json({ success: true, message: "Response sent successfully", inquiry });
  } catch (error) {
    console.error("Respond to inquiry error:", error);
    res.status(500).json({ error: "Failed to send response" });
  }
});

// ====================== UPDATE INQUIRY STATUS ======================
router.patch("/:inquiryId/status", auth, async (req, res) => {
  try {
    const inquiry = await BusinessInquiry.findById(req.params.inquiryId);

    if (!inquiry) {
      return res.status(404).json({ error: "Inquiry not found" });
    }

    // Check if user owns the business
    const business = await Business.findById(inquiry.business);
    if (business.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to update this inquiry" });
    }

    const { status } = req.body;

    if (!["pending", "responded", "closed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    inquiry.status = status;
    await inquiry.save();

    res.json({ success: true, message: "Inquiry status updated", inquiry });
  } catch (error) {
    console.error("Update inquiry status error:", error);
    res.status(500).json({ error: "Failed to update inquiry status" });
  }
});

// ====================== DELETE INQUIRY ======================
router.delete("/:inquiryId", auth, async (req, res) => {
  try {
    const inquiry = await BusinessInquiry.findById(req.params.inquiryId);

    if (!inquiry) {
      return res.status(404).json({ error: "Inquiry not found" });
    }

    // Check if user owns the business or is the inquirer
    const business = await Business.findById(inquiry.business);
    if (
      business.owner.toString() !== req.user.id &&
      inquiry.user?.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ error: "Not authorized to delete this inquiry" });
    }

    await BusinessInquiry.findByIdAndDelete(req.params.inquiryId);

    res.json({ success: true, message: "Inquiry deleted successfully" });
  } catch (error) {
    console.error("Delete inquiry error:", error);
    res.status(500).json({ error: "Failed to delete inquiry" });
  }
});

export default router;
