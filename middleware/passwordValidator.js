// middleware/passwordValidator.js — Centralized, role-aware password policy
// OWASP-aligned: minimum length, character diversity, common-password blocklist.

// Partial list of the most-common passwords (extend as needed).
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789",
  "1234567890", "qwerty", "qwerty123", "qwertyuiop", "abc123",
  "iloveyou", "admin", "admin123", "letmein", "welcome",
  "monkey", "dragon", "master", "sunshine", "princess",
  "football", "baseball", "soccer", "axxspace", "axxspace1",
  "kenya123", "nairobi1", "password!", "P@ssword1",
]);

/**
 * Validate a password against the site-wide policy.
 * Returns { valid: true } or { valid: false, error: "..." }
 */
export function validatePassword(password, options = {}) {
  const {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumber = true,
    requireSpecial = false,
  } = options;

  if (!password || typeof password !== "string") {
    return { valid: false, error: "Password is required." };
  }

  if (password.length < minLength) {
    return { valid: false, error: `Password must be at least ${minLength} characters long.` };
  }

  if (password.length > 128) {
    return { valid: false, error: "Password must not exceed 128 characters." };
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter." };
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter." };
  }

  if (requireNumber && !/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number." };
  }

  if (requireSpecial && !/[!@#$%^&*()_+\-=[\]{}|;':",.<>?/`~\\]/.test(password)) {
    return { valid: false, error: "Password must contain at least one special character." };
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { valid: false, error: "This password is too common. Please choose a stronger one." };
  }

  // Reject passwords that are entirely repeated characters (e.g. "aaaaaaaa")
  if (/^(.)\1+$/.test(password)) {
    return { valid: false, error: "Password must not consist of a single repeated character." };
  }

  return { valid: true };
}

/**
 * Express middleware: validates req.body.password on POST/PUT/PATCH.
 * Usage: router.post("/register", validatePasswordMiddleware, handler)
 */
export function validatePasswordMiddleware(req, res, next) {
  const { password } = req.body;
  if (!password) return next(); // let the route handler produce its own missing-field error

  const result = validatePassword(password);
  if (!result.valid) {
    return res.status(400).json({ error: result.error });
  }
  next();
}
