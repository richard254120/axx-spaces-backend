import express from "express";
import User from "../models/User.js";
import Accommodation from "../models/Accommodation.js";
import Property from "../models/Property.js";
import { auth, adminOnly } from "../middleware/auth.js";
import { getPackage, getAllPackages, calculateExpiryDate, getMaxListings } from "../config/agentPackages.js";

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

// ====================== GET /api/agents/verified ======================
// Public - list all verified agents for the listings page
// Also includes agents who have live listings (assigned properties with approved status)
// Includes each agent's property locations
router.get("/verified", async (req, res) => {
  try {
    const Property = (await import("../models/Property.js")).default;

    // Find agents who are verified OR have approved properties assigned to them
    const agentsWithProperties = await Property.distinct("assignedAgent", {
      status: "approved",
      assignedAgent: { $ne: null }
    });

    const agents = await User.find({
      role: "agent",
      $or: [
        { "agentProfile.verificationStatus": "verified" },
        { _id: { $in: agentsWithProperties } }
      ]
    })
      .select("-password")
      .sort({ name: 1 });

    // Fetch properties for each agent to get their listing locations
    const agentsWithLocations = await Promise.all(
      agents.map(async (agent) => {
        const properties = await Property.find({
          $or: [
            { assignedAgent: agent._id },
            { assignedAgent: agent._id.toString() }
          ],
          status: "approved"
        }).select("location county").lean();

        // Extract unique locations
        const uniqueLocations = [...new Set(properties.map(p => p.location || p.county).filter(Boolean))];

        return {
          ...agent.toObject(),
          listingLocations: uniqueLocations
        };
      })
    );

    res.json(agentsWithLocations);
  } catch (error) {
    console.error("Get verified agents error:", error);
    res.status(500).json({ error: "Failed to fetch verified agents" });
  }
});

// ====================== GET /api/agents/:id/public ======================
// Public - get a single agent's profile and their approved listings
router.get("/:id/public", async (req, res) => {
  try {
    const agent = await User.findById(req.params.id).select("-password -idPhotoFront -selfiePhoto").lean();

    if (!agent || agent.role !== "agent") {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Fetch the agent's approved properties
    const properties = await Property.find({
      $or: [
        { assignedAgent: agent._id },
        { owner: agent._id }
      ],
      status: "approved"
    })
      .select("title location county price propertyType bedrooms bathrooms images")
      .lean();

    res.json({
      _id: agent._id,
      name: agent.name,
      email: agent.email,
      profileImage: agent.profileImage || "",
      agentProfile: {
        phone: agent.agentProfile?.phone || "",
        county: agent.agentProfile?.county || "",
        bio: agent.agentProfile?.bio || "",
        verificationStatus: agent.agentProfile?.verificationStatus || "pending",
      },
      listingCount: properties.length,
      listings: properties,
    });
  } catch (error) {
    console.error("Get public agent error:", error);
    res.status(500).json({ error: "Failed to fetch agent profile" });
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

// ====================== GET /api/agents/packages ======================
// Public - get all available agent packages
router.get("/packages", async (req, res) => {
  try {
    const packages = getAllPackages();
    res.json(packages);
  } catch (error) {
    console.error("Get packages error:", error);
    res.status(500).json({ error: "Failed to fetch packages" });
  }
});

// ====================== POST /api/agents/purchase-package ======================
// Auth required - submit package purchase request for admin approval
router.post("/purchase-package", auth, async (req, res) => {
  try {
    const { tier, paymentMessage } = req.body;

    if (!tier) {
      return res.status(400).json({ error: "Package tier is required" });
    }

    const user = await User.findById(req.user._id);
    if (!user || user.role !== "agent") {
      return res.status(403).json({ error: "Only agents can purchase packages" });
    }

    const packageConfig = getPackage(tier);
    if (!packageConfig) {
      return res.status(400).json({ error: "Invalid package tier" });
    }

    // For free packages (basic), activate immediately
    if (packageConfig.price === 0) {
      const expiresAt = calculateExpiryDate();

      // Update agent package
      user.agentProfile.subscriptionTier = tier;
      user.agentProfile.subscriptionExpiresAt = expiresAt;
      user.agentProfile.packagePurchasedAt = new Date();
      user.agentProfile.packageAmount = 0;
      user.agentProfile.packagePaymentReference = "FREE";

      // Add new purchase to history
      user.agentProfile.packageHistory = user.agentProfile.packageHistory || [];
      user.agentProfile.packageHistory.push({
        tier: tier,
        amount: 0,
        purchasedAt: new Date(),
        expiresAt: expiresAt,
        paymentReference: "FREE",
      });

      await user.save();

      console.log(`Free package activated | User: ${user._id} | Tier: ${tier}`);

      return res.json({
        success: true,
        message: "Package activated successfully",
        package: {
          tier: tier,
          name: packageConfig.name,
          price: 0,
          expiresAt: expiresAt,
          maxActiveListings: packageConfig.maxActiveListings,
        },
        user: {
          _id: user._id,
          name: user.name,
          agentProfile: user.agentProfile,
        },
      });
    }

    // For paid packages, require payment message and create pending purchase
    if (!paymentMessage || !paymentMessage.trim()) {
      return res.status(400).json({ error: "M-Pesa payment message is required for paid packages" });
    }

    // Check if there's already a pending purchase
    if (user.agentProfile?.pendingPackagePurchase?.status === "pending") {
      return res.status(400).json({ error: "You already have a pending package purchase awaiting approval" });
    }

    // Create pending purchase
    user.agentProfile.pendingPackagePurchase = {
      tier: tier,
      amount: packageConfig.price,
      paymentMessage: paymentMessage.trim(),
      submittedAt: new Date(),
      status: "pending",
    };

    await user.save();

    console.log(`Package purchase submitted | User: ${user._id} | Tier: ${tier} | Amount: ${packageConfig.price}`);

    res.json({
      success: true,
      message: "Package purchase submitted for approval. Please wait for admin verification.",
      pendingPurchase: {
        tier: tier,
        name: packageConfig.name,
        amount: packageConfig.price,
        paymentMessage: paymentMessage.trim(),
        submittedAt: user.agentProfile.pendingPackagePurchase.submittedAt,
      },
    });
  } catch (error) {
    console.error("Purchase package error:", error);
    res.status(500).json({ error: "Failed to submit package purchase" });
  }
});

// ====================== GET /api/agents/my-package ======================
// Auth required - get current agent's package status
router.get("/my-package", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || user.role !== "agent") {
      return res.status(403).json({ error: "Only agents can view package status" });
    }

    const currentTier = user.agentProfile?.subscriptionTier || "none";
    const packageConfig = getPackage(currentTier);
    const expiresAt = user.agentProfile?.subscriptionExpiresAt;
    const now = new Date();
    const isActive = expiresAt && new Date(expiresAt) > now;

    // Count active listings for this agent
    const activeListingsCount = await Property.countDocuments({
      assignedAgent: user._id,
      status: "approved"
    });

    res.json({
      currentTier: currentTier,
      isActive: isActive,
      expiresAt: expiresAt,
      package: packageConfig,
      activeListingsCount: activeListingsCount,
      canAddMore: isActive && (currentTier === "verified" || activeListingsCount < (packageConfig?.maxActiveListings || 0)),
      packageHistory: user.agentProfile?.packageHistory || [],
    });
  } catch (error) {
    console.error("Get my package error:", error);
    res.status(500).json({ error: "Failed to fetch package status" });
  }
});

// ====================== GET /api/agents/all-packages ======================
// Admin only - get all agents with their package status
router.get("/all-packages", auth, adminOnly, async (req, res) => {
  try {
    const agents = await User.find({ role: "agent" })
      .select("-password")
      .lean();

    const agentsWithPackages = await Promise.all(
      agents.map(async (agent) => {
        const currentTier = agent.agentProfile?.subscriptionTier || "none";
        const packageConfig = getPackage(currentTier);
        const expiresAt = agent.agentProfile?.subscriptionExpiresAt;
        const now = new Date();
        const isActive = expiresAt && new Date(expiresAt) > now;

        // Count active listings for this agent
        const activeListingsCount = await Property.countDocuments({
          assignedAgent: agent._id,
          status: "approved"
        });

        return {
          _id: agent._id,
          name: agent.name,
          email: agent.email,
          phone: agent.phone,
          county: agent.county,
          currentTier: currentTier,
          isActive: isActive,
          expiresAt: expiresAt,
          package: packageConfig,
          activeListingsCount: activeListingsCount,
          packageHistory: agent.agentProfile?.packageHistory || [],
        };
      })
    );

    res.json(agentsWithPackages);
  } catch (error) {
    console.error("Get all packages error:", error);
    res.status(500).json({ error: "Failed to fetch agent packages" });
  }
});

// ====================== GET /api/agents/my-pending-purchase ======================
// Auth required - get current agent's pending purchase status
router.get("/my-pending-purchase", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || user.role !== "agent") {
      return res.status(403).json({ error: "Only agents can view pending purchase status" });
    }

    const pendingPurchase = user.agentProfile?.pendingPackagePurchase;

    if (!pendingPurchase || pendingPurchase.status !== "pending") {
      return res.json({ hasPending: false, pendingPurchase: null });
    }

    const packageConfig = getPackage(pendingPurchase.tier);

    res.json({
      hasPending: true,
      pendingPurchase: {
        tier: pendingPurchase.tier,
        name: packageConfig?.name,
        amount: pendingPurchase.amount,
        paymentMessage: pendingPurchase.paymentMessage,
        submittedAt: pendingPurchase.submittedAt,
        status: pendingPurchase.status,
      },
    });
  } catch (error) {
    console.error("Get my pending purchase error:", error);
    res.status(500).json({ error: "Failed to fetch pending purchase status" });
  }
});

// ====================== GET /api/agents/debug-pending-purchase ======================
// Auth required - debug route to check pending purchase state
router.get("/debug-pending-purchase", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || user.role !== "agent") {
      return res.status(403).json({ error: "Only agents can view debug info" });
    }

    const pendingPurchase = user.agentProfile?.pendingPackagePurchase;

    res.json({
      userId: user._id,
      hasPendingPurchase: !!pendingPurchase,
      pendingPurchase: pendingPurchase || null,
      fullAgentProfile: user.agentProfile,
    });
  } catch (error) {
    console.error("Debug pending purchase error:", error);
    res.status(500).json({ error: "Failed to fetch debug info" });
  }
});

// ====================== DELETE /api/agents/cancel-pending-purchase ======================
// Auth required - cancel current agent's pending purchase
router.delete("/cancel-pending-purchase", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || user.role !== "agent") {
      return res.status(403).json({ error: "Only agents can cancel pending purchases" });
    }

    const pendingPurchase = user.agentProfile?.pendingPackagePurchase;

    if (!pendingPurchase) {
      return res.status(400).json({ error: "No pending purchase to cancel" });
    }

    // Log the current state for debugging
    console.log(`Cancelling pending purchase | User: ${user._id} | Status: ${pendingPurchase.status} | Full object:`, JSON.stringify(pendingPurchase));

    // Use parent document's unset with dot notation to remove the field
    user.unset("agentProfile.pendingPackagePurchase");

    console.log("Saving user after clearing pending purchase...");
    await user.save();

    console.log(`Pending purchase cancelled successfully | User: ${user._id}`);

    res.json({ success: true, message: "Pending purchase cancelled successfully" });
  } catch (error) {
    console.error("Cancel pending purchase error:", error.message);
    console.error("Error stack:", error.stack);
    res.status(500).json({ error: "Failed to cancel pending purchase", details: error.message });
  }
});

// ====================== GET /api/agents/pending-purchases ======================
// Admin only - get all pending package purchases
router.get("/pending-purchases", auth, adminOnly, async (req, res) => {
  try {
    const agents = await User.find({
      role: "agent",
      "agentProfile.pendingPackagePurchase.status": "pending"
    })
      .select("-password")
      .lean();

    const pendingPurchases = agents.map(agent => ({
      _id: agent._id,
      name: agent.name,
      email: agent.email,
      phone: agent.phone,
      county: agent.county,
      pendingPurchase: agent.agentProfile.pendingPackagePurchase,
    }));

    res.json(pendingPurchases);
  } catch (error) {
    console.error("Get pending purchases error:", error);
    res.status(500).json({ error: "Failed to fetch pending purchases" });
  }
});

// ====================== PUT /api/agents/approve-purchase/:userId ======================
// Admin only - approve a pending package purchase
router.put("/approve-purchase/:userId", auth, adminOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user || user.role !== "agent") {
      return res.status(404).json({ error: "Agent not found" });
    }

    const pendingPurchase = user.agentProfile?.pendingPackagePurchase;
    if (!pendingPurchase || pendingPurchase.status !== "pending") {
      return res.status(400).json({ error: "No pending purchase found" });
    }

    const packageConfig = getPackage(pendingPurchase.tier);
    if (!packageConfig) {
      return res.status(400).json({ error: "Invalid package tier" });
    }

    // Activate the package
    const expiresAt = calculateExpiryDate();
    user.agentProfile.subscriptionTier = pendingPurchase.tier;
    user.agentProfile.subscriptionExpiresAt = expiresAt;
    user.agentProfile.packagePurchasedAt = new Date();
    user.agentProfile.packageAmount = pendingPurchase.amount;
    user.agentProfile.packagePaymentReference = pendingPurchase.paymentMessage;

    // Add to history
    user.agentProfile.packageHistory = user.agentProfile.packageHistory || [];
    user.agentProfile.packageHistory.push({
      tier: pendingPurchase.tier,
      amount: pendingPurchase.amount,
      purchasedAt: new Date(),
      expiresAt: expiresAt,
      paymentReference: pendingPurchase.paymentMessage,
    });

    // Update pending purchase status
    user.agentProfile.pendingPackagePurchase.status = "approved";
    user.agentProfile.pendingPackagePurchase.reviewedAt = new Date();
    user.agentProfile.pendingPackagePurchase.reviewedBy = req.user._id;

    await user.save();

    console.log(`Package purchase approved | User: ${userId} | Tier: ${pendingPurchase.tier}`);

    res.json({
      success: true,
      message: "Package purchase approved successfully",
      package: {
        tier: pendingPurchase.tier,
        name: packageConfig.name,
        amount: pendingPurchase.amount,
        expiresAt: expiresAt,
        maxActiveListings: packageConfig.maxActiveListings,
      },
    });
  } catch (error) {
    console.error("Approve purchase error:", error);
    res.status(500).json({ error: "Failed to approve purchase" });
  }
});

// ====================== PUT /api/agents/reject-purchase/:userId ======================
// Admin only - reject a pending package purchase
router.put("/reject-purchase/:userId", auth, adminOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(userId);

    if (!user || user.role !== "agent") {
      return res.status(404).json({ error: "Agent not found" });
    }

    const pendingPurchase = user.agentProfile?.pendingPackagePurchase;
    if (!pendingPurchase || pendingPurchase.status !== "pending") {
      return res.status(400).json({ error: "No pending purchase found" });
    }

    // Update pending purchase status
    user.agentProfile.pendingPackagePurchase.status = "rejected";
    user.agentProfile.pendingPackagePurchase.reviewedAt = new Date();
    user.agentProfile.pendingPackagePurchase.reviewedBy = req.user._id;
    user.agentProfile.pendingPackagePurchase.rejectionReason = reason || "Payment verification failed";

    await user.save();

    console.log(`Package purchase rejected | User: ${userId} | Reason: ${reason}`);

    res.json({
      success: true,
      message: "Package purchase rejected",
    });
  } catch (error) {
    console.error("Reject purchase error:", error);
    res.status(500).json({ error: "Failed to reject purchase" });
  }
});

export default router;
