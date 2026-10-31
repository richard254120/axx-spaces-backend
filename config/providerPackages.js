// Provider Packages — subscription tiers for landlords (rentals) and hosts (accommodation)
// Mirrors config/agentPackages.js so all provider roles share one upgrade ladder.

const PROVIDER_PACKAGES = {
  landlord: {
    free: {
      name: "FREE",
      price: 0,
      currency: "KSh",
      maxActiveListings: 3,
      features: ["Up to 3 active rental listings", "Standard placement in search"],
      description: "List a few homes free — upgrade when your portfolio grows",
    },
    starter: {
      name: "STARTER",
      price: 499,
      currency: "KSh",
      maxActiveListings: 10,
      features: ["Up to 10 active rental listings", "Priority placement over free listings", "\"Verified landlord\" consideration"],
      description: "For landlords with a growing portfolio",
    },
    pro: {
      name: "PRO",
      price: 1499,
      currency: "KSh",
      maxActiveListings: 50,
      features: ["Up to 50 active rental listings", "Top placement over starter & free", "Listing analytics", "Early access to new tools"],
      description: "For professional landlords and caretakers",
    },
  },
  host: {
    free: {
      name: "FREE",
      price: 0,
      currency: "KSh",
      maxActiveListings: 2,
      features: ["Up to 2 active accommodation listings", "Standard placement in search"],
      description: "Test the marketplace with your first stays",
    },
    starter: {
      name: "STARTER",
      price: 499,
      currency: "KSh",
      maxActiveListings: 8,
      features: ["Up to 8 active accommodation listings", "Priority placement over free listings", "Access to in-platform booking payments"],
      description: "For guesthouse, hotel and B&B operators",
    },
    pro: {
      name: "PRO",
      price: 1499,
      currency: "KSh",
      maxActiveListings: 40,
      features: ["Up to 40 active accommodation listings", "Top placement over starter & free", "Listing analytics", "Early access to new tools"],
      description: "For hotel groups and property managers",
    },
  },
};

const SUBSCRIPTION_DURATION_DAYS = 30;

const getProviderPackage = (role, tier) => {
  const rolePackages = PROVIDER_PACKAGES[role];
  if (!rolePackages) return null;
  return rolePackages[tier] || null;
};

const getAllProviderPackages = (role) => {
  return PROVIDER_PACKAGES[role] || null;
};

const calculateProviderExpiry = (days = SUBSCRIPTION_DURATION_DAYS) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

// Resolve the effective listing cap for a user, honouring their active subscription.
const getEffectiveListingLimit = (user, role) => {
  const packages = PROVIDER_PACKAGES[role];
  if (!packages) return { limit: Infinity, tier: "free" };

  const sub = user.providerSubscription;
  const hasActivePaidSub =
    sub &&
    sub.tier &&
    sub.tier !== "free" &&
    sub.expiresAt &&
    new Date(sub.expiresAt) > new Date();

  const tier = hasActivePaidSub ? sub.tier : "free";
  const pkg = packages[tier] || packages.free;
  return { limit: pkg.maxActiveListings ?? Infinity, tier };
};

export {
  PROVIDER_PACKAGES,
  SUBSCRIPTION_DURATION_DAYS,
  getProviderPackage,
  getAllProviderPackages,
  calculateProviderExpiry,
  getEffectiveListingLimit,
};
