// Roles that can sign in immediately after registering.
// Community Explorers ("user"), legacy "member" accounts, QuickSales sellers
// and guests are buying/selling accounts — email ownership is not a safety
// requirement for them, so they skip the verification step entirely.
// Listing roles (landlord, host, mover, business, ...) still verify first.
export const AUTO_VERIFIED_ROLES = ["user", "member", "seller", "guest"];

export const skipsEmailVerification = (role) => AUTO_VERIFIED_ROLES.includes(role);

export default { AUTO_VERIFIED_ROLES, skipsEmailVerification };
