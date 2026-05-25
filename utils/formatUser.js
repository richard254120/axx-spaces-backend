/** Safe user object for API responses (no password) */
export function formatUserResponse(user) {
  if (!user) return null;
  const obj = user.toObject ? user.toObject() : user;
  return {
    _id: obj._id,
    id: obj._id,
    name: obj.name,
    email: obj.email,
    phone: obj.phone,
    role: obj.role,
    profileImage: obj.profileImage || "",
    isApproved: obj.isApproved,
    walletBalance: obj.walletBalance,
    county: obj.county || "",
    vehicleType: obj.vehicleType || "",
    experienceYears: obj.experienceYears ?? 0,
    services: obj.services || [],
    description: obj.description || "",
    memberSince: obj.createdAt,
    createdAt: obj.createdAt,
  };
}
