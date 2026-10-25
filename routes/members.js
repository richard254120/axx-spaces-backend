import express from "express";
import { auth } from "../middleware/auth.js";
import Favorite from "../models/Favorite.js";
import Inquiry from "../models/Inquiry.js";
import Waitlist from "../models/Waitlist.js";
import Booking from "../models/Booking.js";
import ServiceBooking from "../models/ServiceBooking.js";
import ItemRequest from "../models/ItemRequest.js";
import MaterialInquiry from "../models/MaterialInquiry.js";
import BusinessInquiry from "../models/BusinessInquiry.js";

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

// GET /api/members/bookings
router.get("/bookings", auth, async (req, res) => {
  try {
    const accommodationBookings = await Booking.find({
      $or: [
        { guest: req.user._id },
        { "guestInfo.email": req.user.email },
        { "guestInfo.phone": req.user.phone }
      ]
    })
      .populate("accommodation")
      .populate("roomType")
      .sort({ createdAt: -1 });

    const serviceBookings = await ServiceBooking.find({
      customer: req.user._id
    })
      .populate("provider", "name email phone profileImage")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      bookings: {
        accommodations: accommodationBookings,
        services: serviceBookings,
      }
    });
  } catch (err) {
    console.error("Get member bookings error:", err);
    return res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// GET /api/members/activities (Comprehensive activity overview)
router.get("/activities", auth, async (req, res) => {
  try {
    const userQuery = {
      $or: [
        { user: req.user._id },
        ...(req.user.email ? [{ email: req.user.email }] : []),
        ...(req.user.phone ? [{ phone: req.user.phone }] : [])
      ]
    };

    const [
      favorites,
      waitlistEnquiries,
      directInquiries,
      accommodationBookings,
      serviceBookings,
      itemRequests,
      materialInquiries,
      businessInquiries
    ] = await Promise.all([
      Favorite.find({ user: req.user._id })
        .populate("property")
        .populate("business")
        .sort({ createdAt: -1 }),
      Waitlist.find({
        $or: [{ email: req.user.email }, { phone: req.user.phone }]
      }).populate("property").sort({ createdAt: -1 }),
      Inquiry.find({
        $or: [
          { tenantSessionId: req.user._id.toString() },
          { agent: req.user._id }
        ]
      }).populate("rental").sort({ createdAt: -1 }),
      Booking.find({
        $or: [
          { guest: req.user._id },
          { "guestInfo.email": req.user.email },
          { "guestInfo.phone": req.user.phone }
        ]
      }).populate("accommodation").populate("roomType").sort({ createdAt: -1 }),
      ServiceBooking.find({
        customer: req.user._id
      }).populate("provider", "name email phone profileImage").sort({ createdAt: -1 }),
      ItemRequest.find(userQuery).sort({ createdAt: -1 }),
      MaterialInquiry.find({ buyer: req.user._id }).populate("material").populate("seller", "name phone").sort({ createdAt: -1 }),
      BusinessInquiry.find({
        $or: [
          { user: req.user._id },
          ...(req.user.email ? [{ email: req.user.email }] : [])
        ]
      }).populate("business").sort({ createdAt: -1 }),
    ]);

    const enquiries = [
      ...waitlistEnquiries.map((e) => ({ ...e.toObject(), type: "waitlist" })),
      ...directInquiries.map((e) => ({ ...e.toObject(), type: "rental_inquiry" })),
      ...materialInquiries.map((e) => ({ ...e.toObject(), type: "material_inquiry" })),
      ...businessInquiries.map((e) => ({ ...e.toObject(), type: "business_inquiry" })),
    ].sort((a, b) => new Date(b.createdAt || b.clickedAt || 0) - new Date(a.createdAt || a.clickedAt || 0));

    const totalCount =
      favorites.length +
      enquiries.length +
      accommodationBookings.length +
      serviceBookings.length +
      itemRequests.length;

    return res.json({
      success: true,
      stats: {
        favoritesCount: favorites.length,
        enquiriesCount: enquiries.length,
        bookingsCount: accommodationBookings.length + serviceBookings.length,
        requestsCount: itemRequests.length,
        totalActivities: totalCount,
      },
      favorites,
      enquiries,
      itemRequests,
      bookings: {
        accommodations: accommodationBookings,
        services: serviceBookings,
      },
    });
  } catch (err) {
    console.error("Get member activities error:", err);
    return res.status(500).json({ error: "Failed to fetch activities summary" });
  }
});

export default router;
