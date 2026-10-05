import User from "../models/User.js";
import Property from "../models/Property.js";
import { getPackage, getMaxListings } from "../config/agentPackages.js";

/**
 * Middleware to validate agent package limits before allowing new listings
 * Checks if agent has reached their maximum active listings based on their package tier
 */
export const validateAgentListingLimit = async (req, res, next) => {
  try {
    // Get the agent ID from the request (either from auth or from request body)
    const agentId = req.user?._id || req.body.assignedAgent || req.body.owner;
    
    if (!agentId) {
      return res.status(400).json({ error: "Agent ID is required" });
    }

    // Fetch the agent
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== "agent") {
      return res.status(403).json({ error: "User must be an agent to create listings" });
    }

    // Get the agent's current package tier
    const currentTier = agent.agentProfile?.subscriptionTier || "none";
    
    // Check if subscription is active
    const expiresAt = agent.agentProfile?.subscriptionExpiresAt;
    const now = new Date();
    const isActive = expiresAt && new Date(expiresAt) > now;

    if (!isActive && currentTier !== "none") {
      return res.status(403).json({ 
        error: "Your agent package has expired. Please renew your subscription to add more listings.",
        expired: true,
        expiresAt: expiresAt
      });
    }

    // If agent has no package, they can't add listings
    if (currentTier === "none") {
      return res.status(403).json({ 
        error: "You need to purchase an agent package to create listings. Please select a package to get started.",
        needsPackage: true
      });
    }

    // Get package configuration
    const packageConfig = getPackage(currentTier);
    if (!packageConfig) {
      return res.status(400).json({ error: "Invalid package tier" });
    }

    // Verified agents have unlimited listings
    if (currentTier === "verified") {
      return next();
    }

    // Count active listings for this agent
    const activeListingsCount = await Property.countDocuments({
      assignedAgent: agentId,
      status: "approved"
    });

    // Check if agent has reached their limit
    const maxListings = packageConfig.maxActiveListings;
    if (activeListingsCount >= maxListings) {
      return res.status(403).json({ 
        error: `You have reached your maximum of ${maxListings} active listings for the ${packageConfig.name} package. Please upgrade your package to add more listings.`,
        limitReached: true,
        currentListings: activeListingsCount,
        maxListings: maxListings,
        currentTier: currentTier
      });
    }

    // Agent can add more listings
    next();
  } catch (error) {
    console.error("Agent package validation error:", error);
    res.status(500).json({ error: "Failed to validate agent package" });
  }
};

/**
 * Middleware to check if agent can add a specific number of listings
 * Useful for bulk operations
 */
export const validateAgentBulkListingLimit = (maxToAdd) => {
  return async (req, res, next) => {
    try {
      const agentId = req.user?._id || req.body.assignedAgent || req.body.owner;
      
      if (!agentId) {
        return res.status(400).json({ error: "Agent ID is required" });
      }

      const agent = await User.findById(agentId);
      if (!agent || agent.role !== "agent") {
        return res.status(403).json({ error: "User must be an agent to create listings" });
      }

      const currentTier = agent.agentProfile?.subscriptionTier || "none";
      const expiresAt = agent.agentProfile?.subscriptionExpiresAt;
      const now = new Date();
      const isActive = expiresAt && new Date(expiresAt) > now;

      if (!isActive && currentTier !== "none") {
        return res.status(403).json({ 
          error: "Your agent package has expired. Please renew your subscription to add more listings.",
          expired: true
        });
      }

      if (currentTier === "none") {
        return res.status(403).json({ 
          error: "You need to purchase an agent package to create listings.",
          needsPackage: true
        });
      }

      const packageConfig = getPackage(currentTier);
      if (!packageConfig) {
        return res.status(400).json({ error: "Invalid package tier" });
      }

      if (currentTier === "verified") {
        return next();
      }

      const activeListingsCount = await Property.countDocuments({
        assignedAgent: agentId,
        status: "approved"
      });

      const maxListings = packageConfig.maxActiveListings;
      const availableSlots = maxListings - activeListingsCount;

      if (maxToAdd > availableSlots) {
        return res.status(403).json({ 
          error: `You can only add ${availableSlots} more listings with your current package. You're trying to add ${maxToAdd}. Please upgrade your package.`,
          limitReached: true,
          currentListings: activeListingsCount,
          maxListings: maxListings,
          availableSlots: availableSlots,
          requestedToAdd: maxToAdd
        });
      }

      next();
    } catch (error) {
      console.error("Agent bulk listing validation error:", error);
      res.status(500).json({ error: "Failed to validate agent package for bulk operation" });
    }
  };
};
