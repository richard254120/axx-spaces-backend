// Promotion Catalog — single source of truth for listing monetization
// Applies uniformly to Rentals (Property) and Accommodation listings.
// Frontend fetches these via GET /api/payment/promotion-catalog

const PROMOTION_CATALOG = {
  currency: "KSh",
  // In-platform booking service fee (accommodation bookings paid via M-Pesa)
  bookingServiceFeePercent: Number(process.env.BOOKING_SERVICE_FEE_PERCENT || 10),
  boosts: [
    {
      id: "boost-3days",
      name: "Quick Boost",
      price: 99,
      durationDays: 3,
      tagline: "Jump ahead of fresh listings for a few days",
      features: ["Elevated search placement", "\"Boosted\" ribbon", "Auto-expires — no renewal surprises"],
    },
    {
      id: "boost-7days",
      name: "Weekly Boost",
      price: 250,
      durationDays: 7,
      tagline: "A full week of top-of-search visibility",
      features: ["Elevated search placement", "\"Boosted\" ribbon", "Featured-grid eligibility"],
    },
    {
      id: "boost-30days",
      name: "Monthly Boost",
      price: 700,
      durationDays: 30,
      tagline: "Best value — 30 days of priority placement",
      features: ["Elevated search placement", "\"Boosted\" ribbon", "Featured-grid eligibility", "Lowest cost per day"],
    },
  ],
  homepageFeatures: [
    {
      id: "home-7days",
      name: "Homepage Feature — 1 Week",
      price: 1000,
      durationDays: 7,
      tagline: "Hero-slot exposure on the Axxspace homepage",
      features: ["Homepage featured carousel", "Top placement across search", "Premium \"Featured\" badge"],
    },
    {
      id: "home-30days",
      name: "Homepage Feature — 1 Month",
      price: 1500,
      durationDays: 30,
      tagline: "Maximum exposure for serious listings",
      features: ["Homepage featured carousel", "Top placement across search", "Premium \"Featured\" badge", "Lowest cost per day"],
    },
  ],
};

const findPromotion = (planId) => {
  const plan = [...PROMOTION_CATALOG.boosts, ...PROMOTION_CATALOG.homepageFeatures].find(
    (p) => p.id === planId
  );
  return plan || null;
};

export { PROMOTION_CATALOG, findPromotion };
