const CATEGORY_META = {
  "Beach Resort": { color: "#0ea5e9", emoji: "🏖️" },
  "City Hotel": { color: "#f59e0b", emoji: "🏨" },
  "Mountain Lodge": { color: "#22c55e", emoji: "⛰️" },
  "Safari Camp": { color: "#a855f7", emoji: "🦁" },
  "Camping Grounds": { color: "#84cc16", emoji: "🏕️" },
  "Boutique Hotel": { color: "#f97316", emoji: "🌿" },
  "Eco Lodge": { color: "#10b981", emoji: "🌱" },
  Hotel: { color: "#6366f1", emoji: "🏨" },
};

function averageRating(reviews = []) {
  if (!reviews.length) return 0;
  const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

export function formatTourismCard(listing) {
  const obj = listing.toObject ? listing.toObject() : listing;
  const meta = CATEGORY_META[obj.category] || { color: obj.color || "#0ea5e9", emoji: obj.emoji || "🏨" };
  const rating = averageRating(obj.reviews);
  const reviewCount = obj.reviews?.length || 0;

  return {
    id: obj._id,
    _id: obj._id,
    name: obj.name,
    location: obj.location,
    county: obj.county,
    category: obj.category,
    price: obj.price,
    rating: rating || 4.5,
    reviews: reviewCount,
    color: obj.color || meta.color,
    tag: obj.tag,
    emoji: obj.emoji || meta.emoji,
    amenities: obj.amenities,
    shortDesc: obj.shortDesc || (obj.description?.slice(0, 120) + (obj.description?.length > 120 ? "…" : "")),
    bookingUrl: obj.bookingUrl,
    isFeatured: obj.isFeatured,
    status: obj.status,
    views: obj.views,
    createdAt: obj.createdAt,
  };
}

export function formatTourismDetail(listing) {
  const card = formatTourismCard(listing);
  const obj = listing.toObject ? listing.toObject() : listing;

  const cancellationMap = {
    "24": "Free cancellation up to 24 hours before check-in",
    "48": "Free cancellation up to 48 hours before check-in",
    "72": "Free cancellation up to 72 hours before check-in",
    "7days": "Free cancellation up to 7 days before check-in",
    "0": "Non-refundable",
  };

  return {
    ...card,
    description: obj.description,
    amenities: obj.amenities,
    policies: {
      checkin: obj.policies?.checkIn || "2:00 PM",
      checkout: obj.policies?.checkOut || "11:00 AM",
      cancellation:
        cancellationMap[obj.policies?.cancellation] ||
        obj.policies?.cancellation ||
        "Contact property for cancellation policy",
      payment: obj.policies?.payment || "M-Pesa, Visa, Mastercard accepted",
    },
    roomTypes: (obj.roomTypes || []).map((r) => ({
      name: r.name,
      price: r.price,
      guests: r.guests,
      desc: r.desc || "",
    })),
    reviewList: (obj.reviews || []).map((r) => ({
      name: r.name,
      rating: r.rating,
      date: r.date || (r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-KE", { month: "long", year: "numeric" }) : ""),
      comment: r.comment,
    })),
    manager: obj.manager,
    images: obj.images,
    weekendPrice: obj.weekendPrice,
    peakPrice: obj.peakPrice,
    town: obj.town,
    address: obj.address,
    mapLink: obj.mapLink,
  };
}
