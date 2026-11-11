import jwt from "jsonwebtoken";

// Community accounts (explorers / members) stay signed in until they press
// Log out. Staff, provider and agent portals keep the short session policy.
const PERSISTENT_SESSION_ROLES = new Set(["user", "member"]);

export const DEFAULT_TOKEN_EXPIRY = "7d";
export const DEFAULT_SESSION_MAX_AGE = "24h";
export const PERSISTENT_SESSION_MAX_AGE = "3650d";

export const isPersistentSessionRole = (role) =>
  PERSISTENT_SESSION_ROLES.has(String(role || "").toLowerCase());

export function signSessionToken(user) {
  return jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    {
      expiresIn: isPersistentSessionRole(user.role)
        ? PERSISTENT_SESSION_MAX_AGE
        : DEFAULT_TOKEN_EXPIRY,
    }
  );
}

export function sessionMaxAgeForRole(role) {
  return isPersistentSessionRole(role)
    ? PERSISTENT_SESSION_MAX_AGE
    : DEFAULT_SESSION_MAX_AGE;
}
