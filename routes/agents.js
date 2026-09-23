import express from "express";
import User from "../models/User.js";
import Accommodation from "../models/Accommodation.js";
import Property from "../models/Property.js";
import { auth, adminOnly } from "../middleware/auth.js";

const router = express.Router();

// ====================== POST /api/agents/apply ======================
// Auth required - logged-in user submits phone, county, bio to become an agent
router.post("/apply", auth, async (req, res) => {
  try {
    const { phone, county, bio } = req.body;

    if (!phone || !county || !bio) {
      return res.status(400).json({ error: "Phone, county, and bio are required" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update user to agent role with profile
    user.role = "agent";
    user.agentProfile = {
      phone: phone.trim(),
      county: county.trim(),
      bio: bio.trim(),
      verified: false,
      photo: user.profileImage || "",
    };

    await user.save();

    console.log(`Agent application submitted | User: ${user._id}`);

    res.status(201).json({
      success: true,
      message: "Agent application submitted successfully. Pending verification.",
      user: {
        _id: user._id,
        name: user.name,
        role: user.role,
        agentProfile: user.agentProfile,
      },
    });
  } catch (error) {
    console.error("Agent application error:", error);
    res.status(500).json({ error: error.message || "Failed to submit agent application" });
  }
});

// ====================== GET /api/agents ======================
// Admin only - list all users with role 'agent'
router.get("/", auth, adminOnly, async (req, res) => {
  try {
    const agents = await User.find({ role: "agent" })
      .select("-password")
      .sort({ createdAt: -1 });

    res.json(agents);
  } catch (error) {
    console.error("Get agents error:", error);
    res.status(500).json({ error: "Failed to fetch agents" });
  }
});

// ====================== PUT /api/agents/:id/verify ======================
// Admin only - sets agentProfile.verified: true
router.put("/:id/verify", auth, adminOnly, async (req, res) => {
  try {
    const agent = await User.findById(req.params.id);

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    if (agent.role !== "agent") {
      return res.status(400).json({ error: "User is not an agent" });
    }

    if (!agent.agentProfile) {
      agent.agentProfile = {};
    }

    agent.agentProfile.verified = true;
    await agent.save();

    console.log(`Agent verified | ID: ${agent._id}`);

    res.json({
      success: true,
      message: "Agent verified successfully",
      agent: {
        _id: agent._id,
        name: agent.name,
        role: agent.role,
        agentProfile: agent.agentProfile,
      },
    });
  } catch (error) {
    console.error("Verify agent error:", error);
    res.status(500).json({ error: "Failed to verify agent" });
  }
});

// ====================== PUT /api/agents/assign/:rentalId ======================
// Admin only - assigns a verified agent to a rental (accommodation or property)
router.put("/assign/:rentalId", auth, adminOnly, async (req, res) => {
  try {
    const { agentId } = req.body;

    if (!agentId) {
      return res.status(400).json({ error: "Agent ID is required" });
    }

    // Validate agent exists and is verified
    const agent = await User.findById(agentId);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    if (agent.role !== "agent") {
      return res.status(400).json({ error: "User is not an agent" });
    }

    if (!agent.agentProfile || !agent.agentProfile.verified) {
      return res.status(400).json({ error: "Agent is not verified" });
    }

    // Try to find as accommodation first, then property
    let rental = await Accommodation.findById(req.params.rentalId);
    let rentalType = "accommodation";

    if (!rental) {
      rental = await Property.findById(req.params.rentalId);
      rentalType = "property";
    }

    if (!rental) {
      return res.status(404).json({ error: "Rental not found (neither accommodation nor property)" });
    }

    // Assign agent
    rental.assignedAgent = agentId;
    await rental.save();

    console.log(`Agent assigned to ${rentalType} | Agent: ${agentId} | Rental: ${req.params.rentalId}`);

    res.json({
      success: true,
      message: "Agent assigned successfully",
      rental: {
        _id: rental._id,
        name: rental.name || rental.title,
        type: rentalType,
        assignedAgent: agent._id,
      },
    });
  } catch (error) {
    console.error("Assign agent error:", error);
    res.status(500).json({ error: "Failed to assign agent" });
  }
});

export default router;
