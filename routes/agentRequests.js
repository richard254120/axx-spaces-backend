import express from "express";
import User from "../models/User.js";
import AgentRequest from "../models/AgentRequest.js";
import { auth, agentOnly, hostOnly } from "../middleware/auth.js";

const router = express.Router();

// GET /api/agent-requests - Get all requests for current agent
router.get("/", auth, agentOnly, async (req, res) => {
  try {
    const requests = await AgentRequest.find({ agent: req.user._id })
      .populate("provider", "name email phone profileImage")
      .sort({ requestedAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error("Error fetching agent requests:", error);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
});

// GET /api/agent-requests/provider - Get all requests for current provider
router.get("/provider", auth, hostOnly, async (req, res) => {
  try {
    const requests = await AgentRequest.find({ provider: req.user._id })
      .populate("agent", "name email phone profileImage agentProfile")
      .sort({ requestedAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error("Error fetching provider requests:", error);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
});

// POST /api/agent-requests/send - Send request to a provider
router.post("/send", auth, agentOnly, async (req, res) => {
  try {
    const { providerId, message } = req.body;

    if (!providerId) {
      return res.status(400).json({ error: "Provider ID is required" });
    }

    // Check if provider exists and is a host
    const provider = await User.findById(providerId);
    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }
    if (provider.role !== "host") {
      return res.status(400).json({ error: "User is not a provider" });
    }

    // Check if request already exists
    const existingRequest = await AgentRequest.findOne({
      agent: req.user._id,
      provider: providerId,
      status: { $in: ["pending", "accepted"] },
    });

    if (existingRequest) {
      return res.status(400).json({ error: "Request already exists or is already accepted" });
    }

    const request = await AgentRequest.create({
      agent: req.user._id,
      provider: providerId,
      agentMessage: message,
      status: "pending",
    });

    await request.populate("provider", "name email phone");

    res.status(201).json(request);
  } catch (error) {
    console.error("Error sending agent request:", error);
    res.status(500).json({ error: "Failed to send request" });
  }
});

// PUT /api/agent-requests/:requestId/accept - Accept a request (provider only)
router.put("/:requestId/accept", auth, hostOnly, async (req, res) => {
  try {
    const request = await AgentRequest.findById(req.params.requestId);

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (request.provider.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "You can only respond to requests sent to you" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ error: "Request is not pending" });
    }

    request.status = "accepted";
    request.respondedAt = Date.now();
    await request.save();

    await request.populate("agent", "name email phone");

    res.json(request);
  } catch (error) {
    console.error("Error accepting agent request:", error);
    res.status(500).json({ error: "Failed to accept request" });
  }
});

// PUT /api/agent-requests/:requestId/reject - Reject a request (provider only)
router.put("/:requestId/reject", auth, hostOnly, async (req, res) => {
  try {
    const { response } = req.body;
    const request = await AgentRequest.findById(req.params.requestId);

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (request.provider.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "You can only respond to requests sent to you" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ error: "Request is not pending" });
    }

    request.status = "rejected";
    request.providerResponse = response || "";
    request.respondedAt = Date.now();
    await request.save();

    await request.populate("agent", "name email phone");

    res.json(request);
  } catch (error) {
    console.error("Error rejecting agent request:", error);
    res.status(500).json({ error: "Failed to reject request" });
  }
});

// GET /api/agent-requests/providers - Get all providers (for agents to send requests)
router.get("/providers", auth, agentOnly, async (req, res) => {
  try {
    const providers = await User.find({ role: "host" })
      .select("name email phone profileImage agentProfile")
      .sort({ name: 1 });

    res.json(providers);
  } catch (error) {
    console.error("Error fetching providers:", error);
    res.status(500).json({ error: "Failed to fetch providers" });
  }
});

export default router;
