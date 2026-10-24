import express from "express";
import { auth } from "../middleware/auth.js";
import Favorite from "../models/Favorite.js";
import Inquiry from "../models/Inquiry.js";
import Waitlist from "../models/Waitlist.js";

const router = express.Router();

// GET /api/members/favorites
router.get("/favorites", auth, async (req, res) => {
  try {
    const favorites = await Favorite.find({ user: req.user._id })
      .populate("property")
      .populate("business")
      .sort({ createdAt: -1 });

    return res.json({ success: true, favorites });
  } catch (err) {
    console.error("Get member favorites error:", err);
    return res.status(500).json({ error: "Failed to fetch saved favorites" });
  }
});

// POST /api/members/favorites
router.post("/favorites", auth, async (req, res) => {
  try {
    const { propertyId, businessId, notes, category } = req.body;

    if (!propertyId && !businessId) {
      return res.status(400).json({ error: "propertyId or businessId is required" });
    }

    const query = { user: req.user._id };
    if (propertyId) query.property = propertyId;
    if (businessId) query.business = businessId;

    const existing = await Favorite.findOne(query);
    if (existing) {
      return res.status(400).json({ error: "Listing already in favorites" });
    }

    const favorite = new Favorite({
      user: req.user._id,
      property: propertyId || null,
      business: businessId || null,
      notes: notes || "",
      category: category || "rentals",
    });

    await favorite.save();
    return res.status(201).json({ success: true, message: "Added to favorites", favorite });
  } catch (err) {
    console.error("Add member favorite error:", err);
    return res.status(500).json({ error: "Failed to save favorite" });
  }
});

// DELETE /api/members/favorites/:id
router.delete("/favorites/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Favorite.findOneAndDelete({
      user: req.user._id,
      $or: [{ _id: id }, { property: id }],
    });

    if (!deleted) {
      return res.status(404).json({ error: "Favorite not found" });
    }

    return res.json({ success: true, message: "Removed from favorites" });
  } catch (err) {
    console.error("Delete member favorite error:", err);
    return res.status(500).json({ error: "Failed to delete favorite" });
  }
});

// GET /api/members/enquiries
router.get("/enquiries", auth, async (req, res) => {
  try {
    const waitlistEnquiries = await Waitlist.find({
      $or: [
        { email: req.user.email },
        { phone: req.user.phone },
      ]
    }).populate("property").sort({ createdAt: -1 });

    const directInquiries = await Inquiry.find({
      tenantSessionId: req.user._id.toString()
    }).populate("rental").sort({ createdAt: -1 });

    return res.json({
      success: true,
      enquiries: [...waitlistEnquiries, ...directInquiries],
    });
  } catch (err) {
    console.error("Get member enquiries error:", err);
    return res.status(500).json({ error: "Failed to fetch enquiries" });
  }
});

export default router;
