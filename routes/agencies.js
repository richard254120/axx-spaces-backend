import express from "express";
import User from "../models/User.js";
import Agency from "../models/Agency.js";
import { auth, adminOnly } from "../middleware/auth.js";

const router = express.Router();

// ====================== POST /api/agencies/register ======================
// Agency signup - creates Agency + agency_admin user
router.post("/register", auth, async (req, res) => {
  try {
    const { name, registrationNumber, phone, email, address, county, logo, description, website, adminName, adminEmail, adminPhone, adminPassword } = req.body;

    if (!name || !registrationNumber || !phone || !email || !adminName || !adminEmail || !adminPhone || !adminPassword) {
      return res.status(400).json({ error: "Required fields: name, registrationNumber, phone, email, adminName, adminEmail, adminPhone, adminPassword" });
    }

    // Check if registration number already exists
    const existingAgency = await Agency.findOne({ registrationNumber });
    if (existingAgency) {
      return res.status(400).json({ error: "Registration number already exists" });
    }

    // Check if admin email already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      return res.status(400).json({ error: "Admin email already registered" });
    }

    // Create agency admin user
    const adminUser = await User.create({
      name: adminName,
      email: adminEmail,
      phone: adminPhone,
      password: adminPassword,
      role: "agency_admin",
    });

    // Create agency
    const agency = await Agency.create({
      name,
      registrationNumber,
      phone,
      email,
      admin: adminUser._id,
      agents: [adminUser._id],
      address,
      county,
      logo,
      description,
      website,
    });

    // Link agency to admin user
    adminUser.agentProfile = {
      agencyId: agency._id,
      verificationStatus: "verified",
    };
    await adminUser.save();

    console.log(`Agency registered | ID: ${agency._id} | Admin: ${adminUser._id}`);

    res.status(201).json({
      success: true,
      message: "Agency registered successfully",
      agency: {
        _id: agency._id,
        name: agency.name,
        registrationNumber: agency.registrationNumber,
        admin: adminUser._id,
      },
    });
  } catch (error) {
    console.error("Agency registration error:", error);
    res.status(500).json({ error: error.message || "Failed to register agency" });
  }
});

// ====================== POST /api/agencies/:agencyId/agents/invite ======================
// Agency admin invites/adds an agent to roster
router.post("/:agencyId/agents/invite", auth, async (req, res) => {
  try {
    const { agentId } = req.body;

    if (!agentId) {
      return res.status(400).json({ error: "Agent ID is required" });
    }

    const agency = await Agency.findById(req.params.agencyId);
    if (!agency) {
      return res.status(404).json({ error: "Agency not found" });
    }

    // Check if user is agency admin
    if (req.user.role !== "admin" && agency.admin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Only agency admin can invite agents" });
    }

    const agent = await User.findById(agentId);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    if (agent.role !== "agent") {
      return res.status(400).json({ error: "User is not an agent" });
    }

    // Check if agent already in agency
    if (agency.agents.includes(agentId)) {
      return res.status(400).json({ error: "Agent already in agency" });
    }

    // Add agent to agency
    agency.agents.push(agentId);
    await agency.save();

    // Link agency to agent
    agent.agentProfile = agent.agentProfile || {};
    agent.agentProfile.agencyId = agency._id;
    await agent.save();

    console.log(`Agent invited to agency | Agency: ${agency._id} | Agent: ${agentId}`);

    res.json({
      success: true,
      message: "Agent added to agency successfully",
      agency: {
        _id: agency._id,
        name: agency.name,
        agents: agency.agents,
      },
    });
  } catch (error) {
    console.error("Invite agent error:", error);
    res.status(500).json({ error: "Failed to invite agent" });
  }
});

// ====================== GET /api/agencies/:agencyId/agents ======================
// List agency's agents + their stats
router.get("/:agencyId/agents", auth, async (req, res) => {
  try {
    const agency = await Agency.findById(req.params.agencyId);
    if (!agency) {
      return res.status(404).json({ error: "Agency not found" });
    }

    // Check if user is agency admin or admin
    if (req.user.role !== "admin" && agency.admin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied" });
    }

    const agents = await User.find({ _id: { $in: agency.agents }, role: "agent" })
      .select("-password")
      .sort({ name: 1 });

    res.json(agents);
  } catch (error) {
    console.error("Get agency agents error:", error);
    res.status(500).json({ error: "Failed to fetch agency agents" });
  }
});

// ====================== DELETE /api/agencies/:agencyId/agents/:agentId ======================
// Remove agent from agency
router.delete("/:agencyId/agents/:agentId", auth, async (req, res) => {
  try {
    const agency = await Agency.findById(req.params.agencyId);
    if (!agency) {
      return res.status(404).json({ error: "Agency not found" });
    }

    // Check if user is agency admin or admin
    if (req.user.role !== "admin" && agency.admin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Remove agent from agency
    agency.agents = agency.agents.filter(id => id.toString() !== req.params.agentId);
    await agency.save();

    // Unlink agency from agent
    const agent = await User.findById(req.params.agentId);
    if (agent && agent.agentProfile) {
      agent.agentProfile.agencyId = null;
      await agent.save();
    }

    console.log(`Agent removed from agency | Agency: ${agency._id} | Agent: ${req.params.agentId}`);

    res.json({
      success: true,
      message: "Agent removed from agency successfully",
    });
  } catch (error) {
    console.error("Remove agent error:", error);
    res.status(500).json({ error: "Failed to remove agent" });
  }
});

// ====================== GET /api/agencies ======================
// Admin only - list all agencies
router.get("/", auth, adminOnly, async (req, res) => {
  try {
    const agencies = await Agency.find()
      .populate("admin", "name email phone")
      .sort({ createdAt: -1 });

    res.json(agencies);
  } catch (error) {
    console.error("Get agencies error:", error);
    res.status(500).json({ error: "Failed to fetch agencies" });
  }
});

export default router;
