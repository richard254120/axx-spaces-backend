// Masks listing-owner contact details on public responses.
// The frontend swaps in a "Reveal contact" flow backed by /api/contact-reveal.
// Provider roles (and the owner themselves) keep full access — see routes/contactReveal.js.

const PROVIDER_ROLES = ["landlord", "agent", "host", "business", "provider", "caretaker", "admin", "team", "mover", "seller"];

export function maskOwnerContact(obj, req) {
  if (!obj) return obj;
  const user = req?.user;
  const role = user?.role;
  const ownerRef = obj.owner?._id || obj.owner;
  const isOwner =
    user && ownerRef && ownerRef.toString() === user._id.toString();

  if (isOwner || (role && PROVIDER_ROLES.includes(role))) {
    obj.contactRevealed = true;
    return obj;
  }

  if (obj.owner && typeof obj.owner === "object") {
    const plain = typeof obj.owner.toObject === "function" ? obj.owner.toObject() : obj.owner;
    delete plain.phone;
    delete plain.email;
    plain.contactMasked = true;
    obj.owner = plain;
  } else {
    obj.contactMasked = true;
  }
  // Top-level fallback phones used by some listings (e.g. sale listings store phone directly)
  delete obj.phone;
  return obj;
}
