// Agent Package Configuration
// Defines the different subscription tiers, pricing, and features

const AGENT_PACKAGES = {
  basic: {
    name: "BASIC",
    price: 0,
    currency: "KSh",
    maxActiveListings: 5,
    features: [
      "Agent profile",
      "Up to 5 active listings",
      "Standard Axxspace QR code",
      "Digital profile link"
    ],
    description: "Perfect for getting started with agent services"
  },
  pro: {
    name: "PRO",
    price: 1500,
    currency: "KSh",
    maxActiveListings: 30,
    features: [
      "Up to 30 active listings",
      "Custom agent QR code",
      "Professional digital agent card",
      "Print-ready card design",
      "Print-ready poster design",
      "QR scan statistics"
    ],
    description: "For growing agents with more listings"
  },
  pro_plus: {
    name: "PRO+",
    price: 2500,
    currency: "KSh",
    maxActiveListings: 50,
    features: [
      "Up to 50 active listings",
      "Multiple QR designs",
      "Professional digital agent card",
      "Print-ready cards",
      "Print-ready posters",
      "Print-ready sticker designs",
      "QR scan statistics",
      "Enhanced agent profile"
    ],
    description: "For established agents with extensive portfolios"
  },
  verified: {
    name: "VERIFIED AGENT",
    price: 5000,
    currency: "KSh",
    maxActiveListings: 100, // Unlimited for verified agents
    features: [
      "Everything in Pro+",
      "Physical verification",
      "Axxspace representative visits the agent",
      "Identity/document checks",
      "Property/business documentation checks",
      "Verification agreement signed",
      "Verified Agent badge",
      "Verification record maintained by Axxspace",
      "Individual/custom QR code",
      "Priority placement/features"
    ],
    description: "Premium tier with full verification and priority features"
  }
};

// Package duration in days (30 days = 1 month)
const PACKAGE_DURATION_DAYS = 30;

// Helper function to get package by tier
const getPackage = (tier) => {
  return AGENT_PACKAGES[tier] || null;
};

// Helper function to get all packages
const getAllPackages = () => {
  return AGENT_PACKAGES;
};

// Helper function to calculate expiry date
const calculateExpiryDate = (days = PACKAGE_DURATION_DAYS) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

// Helper function to check if agent can add more listings
const canAddListing = (agent) => {
  const tier = agent.agentProfile?.subscriptionTier || "none";
  const packageConfig = getPackage(tier);

  if (!packageConfig) {
    return false;
  }

  // Verified agents have unlimited listings
  if (tier === "verified") {
    return true;
  }

  // Check if subscription is active
  if (!agent.agentProfile?.subscriptionExpiresAt) {
    return false;
  }

  const now = new Date();
  if (new Date(agent.agentProfile.subscriptionExpiresAt) < now) {
    return false;
  }

  // Count active listings for this agent
  // This will be handled in the route/middleware
  return true;
};

// Helper function to get max listings for a tier
const getMaxListings = (tier) => {
  const packageConfig = getPackage(tier);
  return packageConfig ? packageConfig.maxActiveListings : 0;
};

export {
  AGENT_PACKAGES,
  PACKAGE_DURATION_DAYS,
  getPackage,
  getAllPackages,
  calculateExpiryDate,
  canAddListing,
  getMaxListings
};
