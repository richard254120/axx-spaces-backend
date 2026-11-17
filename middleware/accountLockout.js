// middleware/accountLockout.js — Persistent account-level brute-force protection
// Works in tandem with the IP-level rate limiter in enhancedSecurity.js.
// Failed attempts are stored on the User document so they survive server restarts.
//
// Policy:
//   • 5 failed attempts within 15 minutes → lock account for 30 minutes
//   • Admin accounts get a stricter threshold (3 attempts)

import User from "../models/User.js";

const ADMIN_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;   // 15 minutes
const LOCKOUT_MS = 30 * 60 * 1000;  // 30-minute lock

/**
 * Check if an account should be locked.
 * Returns { locked: false } or { locked: true, retryAfterMs, retryAfterMinutes }
 */
export async function checkAccountLock(user) {
  if (!user) return { locked: false };

  const now = Date.now();

  // If a lockout is active and not yet expired
  if (user.lockoutUntil && new Date(user.lockoutUntil).getTime() > now) {
    const remaining = new Date(user.lockoutUntil).getTime() - now;
    return {
      locked: true,
      retryAfterMs: remaining,
      retryAfterMinutes: Math.ceil(remaining / 60000),
    };
  }

  return { locked: false };
}

/**
 * Record a failed login attempt. Applies lockout when threshold is reached.
 * Call this AFTER a confirmed bad password.
 */
export async function recordFailedLogin(user) {
  if (!user) return;

  const now = Date.now();
  const maxAttempts = ["admin", "team"].includes(user.role) ? ADMIN_MAX_ATTEMPTS : DEFAULT_MAX_ATTEMPTS;

  // Reset counter if the previous window has expired
  const windowStart = user.loginAttemptWindowStart
    ? new Date(user.loginAttemptWindowStart).getTime()
    : 0;

  if (now - windowStart > WINDOW_MS) {
    user.failedLoginAttempts = 1;
    user.loginAttemptWindowStart = new Date();
  } else {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
  }

  if (user.failedLoginAttempts >= maxAttempts) {
    user.lockoutUntil = new Date(now + LOCKOUT_MS);
    user.failedLoginAttempts = 0; // reset so next window starts clean
    await user.save();
    return { lockedOut: true };
  }

  await user.save();
  return { lockedOut: false, attemptsLeft: maxAttempts - user.failedLoginAttempts };
}

/**
 * Clear failed attempts on successful login.
 */
export async function clearFailedLogins(user) {
  if (!user) return;
  if (user.failedLoginAttempts || user.lockoutUntil) {
    user.failedLoginAttempts = 0;
    user.loginAttemptWindowStart = undefined;
    user.lockoutUntil = undefined;
    await user.save();
  }
}

/**
 * Express middleware for use directly on the login route.
 * Expects req.body.email and optional req.body.role.
 * Sets req.accountLockout = { locked, user } for the route handler.
 */
export async function accountLockoutMiddleware(req, res, next) {
  const { email, role } = req.body;
  if (!email) return next();

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    let query = { email: normalizedEmail };
    if (role) query.role = String(role).trim().toLowerCase();

    // Load only lockout fields to avoid pulling in password
    const user = await User.findOne(query).select("+failedLoginAttempts +loginAttemptWindowStart +lockoutUntil");
    if (!user) return next();

    const lock = await checkAccountLock(user);
    if (lock.locked) {
      return res.status(423).json({
        error: `Account temporarily locked due to too many failed attempts. Please try again in ${lock.retryAfterMinutes} minute${lock.retryAfterMinutes === 1 ? "" : "s"}.`,
        code: "ACCOUNT_LOCKED",
        retryAfterMinutes: lock.retryAfterMinutes,
      });
    }

    // Attach user ref for the route handler to use (avoids double DB lookup)
    req._lockoutUser = user;
    next();
  } catch (err) {
    console.error("[AccountLockout] Error checking lockout:", err.message);
    next(); // fail open — don't block legitimate users on a lockout DB error
  }
}

