import express from "express";
import Property from "../models/Property.js";
import Accommodation from "../models/Accommodation.js";
import Inquiry from "../models/Inquiry.js";
import { auth, agentOnly, adminOnly } from "../middleware/auth.js";
import security from "../middleware/security.js";

const router = express.Router();

// ====================== POST /api/inquiries/log ======================
// Public endpoint - fired when tenant clicks WhatsApp button (no auth needed, rate-limited by IP)
router.post("/log", security.inquiryLimiter, async (req, res) => {
  try {
    const { rentalId, agentId, tenantIp, tenantSessionId } = req.body;

    if (!rentalId || !agentId) {
      return res.status(400).json({ error: "Rental ID and Agent ID are required" });
    }

    // Try to find as accommodation first, then property
    let rental = await Accommodation.findById(rentalId);
    let rentalType = "accommodation";

    if (!rental) {
      rental = await Property.findById(rentalId);
      rentalType = "property";
    }

    if (!rental) {
      return res.status(404).json({ error: "Rental not found" });
    }

    // Check if rental has an assigned agent
    if (!rental.assignedAgent || rental.assignedAgent.toString() !== agentId) {
      return res.status(400).json({ error: "Agent not assigned to this rental" });
    }

    // Log inquiry (fire-and-forget, don't block WhatsApp redirect)
    await Inquiry.create({
      rental: rentalId,
      agent: agentId,
      tenantIp: tenantIp || req.ip,
      tenantSessionId: tenantSessionId,
    });

    console.log(`Inquiry logged | Rental: ${rentalId} | Agent: ${agentId} | IP: ${tenantIp || req.ip}`);

    res.json({ success: true, message: "Inquiry logged" });
  } catch (error) {
    console.error("Log inquiry error:", error);
    // Don't block WhatsApp redirect even if logging fails
    res.json({ success: true, message: "Inquiry logging attempted" });
  }
});

// ====================== GET /api/inquiries/agent/:agentId ======================
// Agent/admin: inquiry count + list for that agent
router.get("/agent/:agentId", auth, async (req, res) => {
  try {
    const { agentId } = req.params;

    // Check if user is the agent or admin
    if (req.user.role !== "admin" && req.user._id.toString() !== agentId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const inquiries = await Inquiry.find({ agent: agentId })
      .populate("rental", "name title")
      .sort({ clickedAt: -1 });

    const count = await Inquiry.countDocuments({ agent: agentId });

    res.json({
      count,
      inquiries,
    });
  } catch (error) {
    console.error("Get agent inquiries error:", error);
    res.status(500).json({ error: "Failed to fetch inquiries" });
  }
});

// ====================== PUT /api/inquiries/:id/status ======================
// Update followUpStatus
router.put("/:id/status", auth, async (req, res) => {
  try {
    const { followUpStatus, notes } = req.body;

    if (!followUpStatus || !["pending", "connected", "no_response"].includes(followUpStatus)) {
      return res.status(400).json({ error: "Invalid follow-up status" });
    }

    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) {
      return res.status(404).json({ error: "Inquiry not found" });
    }

    // Check if user is the agent or admin
    if (req.user.role !== "admin" && inquiry.agent.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied" });
    }

    inquiry.followUpStatus = followUpStatus;
    if (notes) {
      inquiry.notes = notes;
    }
    await inquiry.save();

    res.json({
      success: true,
      message: "Inquiry status updated",
      inquiry,
    });
  } catch (error) {
    console.error("Update inquiry status error:", error);
    res.status(500).json({ error: "Failed to update inquiry status" });
  }
});

export default router;
