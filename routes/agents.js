import express from "express";
import User from "../models/User.js";
import Accommodation from "../models/Accommodation.js";
import Property from "../models/Property.js";
import { auth, adminOnly } from "../middleware/auth.js";

const router = express.Router();

// ====================== POST /api/agents/apply ======================
// Auth required - logged-in user submits phone, county, bio, ID number, ID photo, selfie to become an agent
router.post("/apply", auth, async (req, res) => {
  try {
    const { phone, county, bio, idNumber, idPhotoFront, selfiePhoto } = req.body;

    if (!phone || !county || !bio || !idNumber || !idPhotoFront || !selfiePhoto) {
      return res.status(400).json({ error: "Phone, county, bio, ID number, ID photo, and selfie are required" });
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
      photo: user.profileImage || "",
      idNumber: idNumber.trim(),
      idPhotoFront: idPhotoFront.trim(),
      selfiePhoto: selfiePhoto.trim(),
      verificationStatus: "pending",
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
// Admin only - list all users with role 'agent', filterable by verificationStatus
router.get("/", auth, adminOnly, async (req, res) => {
  try {
    const { verificationStatus } = req.query;
    const filter = { role: "agent" };

    if (verificationStatus) {
      filter["agentProfile.verificationStatus"] = verificationStatus;
    }

    const agents = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 });

    res.json(agents);
  } catch (error) {
    console.error("Get agents error:", error);
    res.status(500).json({ error: "Failed to fetch agents" });
  }
});

// ====================== PUT /api/agents/:id/verify ======================
// Admin only - sets agentProfile.verificationStatus: 'verified'
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

    agent.agentProfile.verificationStatus = "verified";
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

// ====================== PUT /api/agents/:id/reject ======================
// Admin only - sets agentProfile.verificationStatus: 'rejected' with reason
router.put("/:id/reject", auth, adminOnly, async (req, res) => {
  try {
    const { reason } = req.body;
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

    agent.agentProfile.verificationStatus = "rejected";
    agent.agentProfile.rejectionReason = reason || "Verification failed";
    await agent.save();

    console.log(`Agent rejected | ID: ${agent._id} | Reason: ${reason}`);

    res.json({
      success: true,
      message: "Agent application rejected",
      agent: {
        _id: agent._id,
        name: agent.name,
        role: agent.role,
        agentProfile: agent.agentProfile,
      },
    });
  } catch (error) {
    console.error("Reject agent error:", error);
    res.status(500).json({ error: "Failed to reject agent" });
  }
});

// ====================== PUT /api/agents/assign/:rentalId ======================
// Admin only - assigns a VERIFIED agent to a rental (accommodation or property)
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

    if (!agent.agentProfile || agent.agentProfile.verificationStatus !== "verified") {
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

// ====================== POST /api/agents/:rentalId/authorize ======================
// Landlord OTP confirmation flow - sends OTP to landlord's phone
router.post("/:rentalId/authorize", auth, async (req, res) => {
  try {
    const { method } = req.body;

    if (!method || !["landlord_otp_confirmed", "authorization_letter"].includes(method)) {
      return res.status(400).json({ error: "Invalid authorization method" });
    }

    // Try to find as accommodation first, then property
    let rental = await Accommodation.findById(req.params.rentalId).populate("owner");
    let rentalType = "accommodation";

    if (!rental) {
      rental = await Property.findById(req.params.rentalId).populate("owner");
      rentalType = "property";
    }

    if (!rental) {
      return res.status(404).json({ error: "Rental not found" });
    }

    // Check if user is the owner or admin
    if (req.user.role !== "admin" && rental.owner._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Only owner or admin can authorize listing" });
    }

    if (method === "landlord_otp_confirmed") {
      // Generate and send OTP (placeholder - integrate with SMS/WhatsApp service)
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // TODO: Send OTP via SMS/WhatsApp to rental.owner.phone
      console.log(`OTP sent to ${rental.owner.phone}: ${otp}`);

      // Store OTP temporarily (in production, use Redis with expiry)
      rental.listingAuthorization = {
        method: "landlord_otp_confirmed",
        otp: otp,
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        confirmedAt: null,
      };
      await rental.save();

      res.json({
        success: true,
        message: "OTP sent to landlord's phone",
        method: "landlord_otp_confirmed",
      });
    }
  } catch (error) {
    console.error("Authorize rental error:", error);
    res.status(500).json({ error: "Failed to initiate authorization" });
  }
});

// ====================== POST /api/agents/:rentalId/confirm-otp ======================
// Agent submits OTP to confirm listing authorization
router.post("/:rentalId/confirm-otp", auth, async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ error: "OTP is required" });
    }

    // Try to find as accommodation first, then property
    let rental = await Accommodation.findById(req.params.rentalId);
    let rentalType = "accommodation";

    if (!rental) {
      rental = await Property.findById(req.params.rentalId);
      rentalType = "property";
    }

    if (!rental) {
      return res.status(404).json({ error: "Rental not found" });
    }

    // Check if OTP exists and is valid
    if (!rental.listingAuthorization || rental.listingAuthorization.method !== "landlord_otp_confirmed") {
      return res.status(400).json({ error: "No pending OTP authorization" });
    }

    if (rental.listingAuthorization.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    if (new Date() > rental.listingAuthorization.otpExpiresAt) {
      return res.status(400).json({ error: "OTP has expired" });
    }

    // Confirm authorization
    rental.listingAuthorization = {
      method: "landlord_otp_confirmed",
      confirmedAt: new Date(),
    };
    await rental.save();

    console.log(`Listing authorized via OTP | Rental: ${req.params.rentalId}`);

    res.json({
      success: true,
      message: "Listing authorization confirmed",
      rental: {
        _id: rental._id,
        listingAuthorization: rental.listingAuthorization,
      },
    });
  } catch (error) {
    console.error("Confirm OTP error:", error);
    res.status(500).json({ error: "Failed to confirm OTP" });
  }
});

// ====================== POST /api/agents/:rentalId/authorization-letter ======================
// Upload authorization letter as alternative proof
router.post("/:rentalId/authorization-letter", auth, async (req, res) => {
  try {
    const { proofUrl } = req.body;

    if (!proofUrl) {
      return res.status(400).json({ error: "Proof URL is required" });
    }

    // Try to find as accommodation first, then property
    let rental = await Accommodation.findById(req.params.rentalId);
    let rentalType = "accommodation";

    if (!rental) {
      rental = await Property.findById(req.params.rentalId);
      rentalType = "property";
    }

    if (!rental) {
      return res.status(404).json({ error: "Rental not found" });
    }

    // Check if user is the owner or admin
    if (req.user.role !== "admin" && rental.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Only owner or admin can upload authorization letter" });
    }

    rental.listingAuthorization = {
      method: "authorization_letter",
      proofUrl: proofUrl,
      confirmedAt: new Date(),
    };
    await rental.save();

    console.log(`Authorization letter uploaded | Rental: ${req.params.rentalId}`);

    res.json({
      success: true,
      message: "Authorization letter uploaded successfully",
      rental: {
        _id: rental._id,
        listingAuthorization: rental.listingAuthorization,
      },
    });
  } catch (error) {
    console.error("Upload authorization letter error:", error);
    res.status(500).json({ error: "Failed to upload authorization letter" });
  }
});

export default router;
