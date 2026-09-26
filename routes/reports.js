import express from "express";
import User from "../models/User.js";
import Property from "../models/Property.js";
import AgentReport from "../models/AgentReport.js";
import { auth, adminOnly } from "../middleware/auth.js";
import security from "../middleware/security.js";

const router = express.Router();

// ====================== POST /api/reports ======================
// Public endpoint - tenant reports an agent (no auth required, rate-limited)
router.post("/", security.reportLimiter, async (req, res) => {
  try {
    const { agentId, rentalId, reason, details, reporterContact } = req.body;

    if (!agentId || !reason || !reporterContact) {
      return res.status(400).json({ error: "Agent ID, reason, and reporter contact are required" });
    }

    // Validate agent exists
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== "agent") {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Validate rental if provided
    if (rentalId) {
      const rental = await Property.findById(rentalId);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }
    }

    // Create report
    const report = await AgentReport.create({
      agent: agentId,
      rental: rentalId || null,
      reason,
      details,
      reporterContact,
      status: "open",
    });

    console.log(`Agent report created | Agent: ${agentId} | Reason: ${reason}`);

    res.status(201).json({
      success: true,
      message: "Report submitted successfully",
      report,
    });
  } catch (error) {
    console.error("Create report error:", error);
    res.status(500).json({ error: "Failed to submit report" });
  }
});

// ====================== GET /api/reports ======================
// Admin only - list open reports
router.get("/", auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};

    if (status) {
      filter.status = status;
    }

    const reports = await AgentReport.find(filter)
      .populate("agent", "name email phone agentProfile")
      .populate("rental", "title location")
      .sort({ createdAt: -1 });

    res.json(reports);
  } catch (error) {
    console.error("Get reports error:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// ====================== PUT /api/reports/:id/status ======================
// Admin: mark reviewed/actioned; auto-flag agent if reports >= 3 open
router.put("/:id/status", auth, adminOnly, async (req, res) => {
  try {
    const { status, actionTaken } = req.body;

    if (!status || !["open", "reviewed", "actioned"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const report = await AgentReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    report.status = status;
    report.reviewedBy = req.user._id;
    report.reviewedAt = new Date();
    if (actionTaken) {
      report.actionTaken = actionTaken;
    }
    await report.save();

    // Auto-flag agent if open reports >= 3
    if (status === "open") {
      const openReportCount = await AgentReport.countDocuments({
        agent: report.agent,
        status: "open",
      });

      if (openReportCount >= 3) {
        const agent = await User.findById(report.agent);
        if (agent && agent.agentProfile) {
          agent.agentProfile.verificationStatus = "rejected";
          agent.agentProfile.rejectionReason = "Multiple open reports";
          await agent.save();
          console.log(`Agent auto-flagged due to multiple reports | Agent: ${report.agent}`);
        }
      }
    }

    res.json({
      success: true,
      message: "Report status updated",
      report,
    });
  } catch (error) {
    console.error("Update report status error:", error);
    res.status(500).json({ error: "Failed to update report status" });
  }
});

export default router;
