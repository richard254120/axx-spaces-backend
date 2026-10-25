import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import { protect as auth } from "../middleware/auth.js";
import { formatUserResponse } from "../utils/formatUser.js";
import { Resend } from "resend";
import { sendMoverRegistrationEmail, sendSellerRegistrationEmail, sendLandlordRegistrationEmail, sendTourismApprovalEmail, sendMoverApprovalEmail, sendWelcomeEmail, sendVerificationEmail } from "../utils/email.js";
import security from "../middleware/enhancedSecurity.js";
import upload from "../config/multer.js";

const router = express.Router();

// Email validation helper: standard RFC 5322 regex + domain / TLD verification
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(trimmed)) return false;
  const parts = trimmed.split("@");
  if (parts.length !== 2) return false;
  const domain = parts[1];
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) return false;
  const tld = domain.split(".").pop();
  if (!tld || tld.length < 2) return false;
  return true;
}

// ── Initialize Resend only if API key is available
let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

// ── Single source of truth for the sender address.
//    Always reads from env — no "onboarding@resend.dev" fallback.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ? `AxxSpace <${process.env.RESEND_FROM_EMAIL}>` : "Axxspace <admin@axxspace.com>";

// ====================== REGISTER MEMBER ======================
router.post("/register-member", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: "Name, email, phone, and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
      return res.status(400).json({ error: "Password must contain a mixture of both letters and numbers." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: "Please enter a valid email address (e.g. name@gmail.com)" });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ error: "An account with this email is already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    const newUser = new User({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      password: hashedPassword,
      role: "member",
      isEmailVerified: false,
      isApproved: true,
      emailVerificationToken: verificationToken,
      emailVerificationExpiry: verificationExpiry,
    });

    await newUser.save();

    await sendVerificationEmail({
      to: newUser.email,
      name: newUser.name,
      token: verificationToken,
      req,
    });

    return res.status(201).json({
      message: "Registration successful! A verification email has been sent to your email. Please verify before logging in.",
      requiresVerification: true,
      email: newUser.email,
    });
  } catch (err) {
    console.error("Member registration error:", err);
    return res.status(500).json({ error: err.message || "Member registration failed" });
  }
});

// ====================== REGISTER ======================
router.post("/register", upload.array("workPhotos", 10), async (req, res) => {
  try {
    const {
      name, email, password, phone, role,
      county, services, vehicleType, experience,
      landlordType, company, description,
      baseRate, rateType, minCharge,
      hasInsurance, insuranceProvider, coverageAmount,
      teamSize, specialties, serviceAreas,
      availability, responseTime, languages, certifications,
      equipment, workHours, uniform, safetyGear, loadingEquipment,
    } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: "Name, email, password, and phone are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
      return res.status(400).json({ error: "Password must contain a mixture of both letters and numbers." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: "Please enter a valid email address (e.g. name@gmail.com)" });
    }

    const targetRole = role || "landlord";
    const existingUser = await User.findOne({ email: normalizedEmail, role: targetRole });
    if (existingUser) {
      return res.status(400).json({ error: `An account with this email is already registered as a ${targetRole}` });
    }

    const existingPhone = await User.findOne({ phone: phone.trim(), role: targetRole });
    if (existingPhone) {
      return res.status(400).json({ error: `An account with this phone number is already registered as a ${targetRole}` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    const newUser = new User({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone: phone.trim(),
      role: targetRole,
      isApproved: ["host", "landlord", "member", "user", "guest", "business"].includes(targetRole),
      landlordType:
        targetRole === "landlord" && landlordType === "university"
          ? "university"
          : "general",
      isEmailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpiry: verificationExpiry,
    });

    if (role === "mover") {
      newUser.county = county || "";
      newUser.services = services || [];
      newUser.vehicleType = vehicleType || "";
      newUser.experienceYears = experience || 0;
      newUser.isApproved = false;
      // Additional mover fields
      newUser.company = company || "";
      newUser.description = description || "";
      newUser.pricing = {
        baseRate: parseFloat(baseRate) || 0,
        rateType: rateType || "per_job",
        minCharge: parseFloat(minCharge) || 0,
      };
      newUser.insurance = {
        hasInsurance: hasInsurance === "true",
        provider: insuranceProvider || "",
        coverageAmount: parseFloat(coverageAmount) || 0,
      };
      newUser.teamInfo = {
        teamSize: parseInt(teamSize) || 1,
      };
      newUser.specialties = specialties ? specialties.split(',').map(s => s.trim()) : [];
      newUser.serviceAreas = serviceAreas ? serviceAreas.split(',').map(s => s.trim()) : [];
      // Store availability as a simple string for display, or as object if needed
      newUser.availability = availability || "";
      newUser.responseTime = responseTime || "";
      newUser.languages = languages ? languages.split(',').map(s => s.trim()) : [];
      newUser.certifications = certifications ? certifications.split(',').map(s => s.trim()) : [];
      // New equipment and safety fields
      newUser.equipment = equipment || "";
      newUser.workHours = workHours || "";
      newUser.uniform = uniform === "true";
      newUser.safetyGear = safetyGear === "true";
      newUser.loadingEquipment = loadingEquipment || "";
      // Handle work photos with descriptions and categories
      if (req.files && req.files.length > 0) {
        newUser.workPhotos = req.files.map(file => file.path || file.secure_url);
        newUser.portfolioDetails = [];
        // Extract photo descriptions and categories from form data
        for (let i = 0; i < req.files.length; i++) {
          newUser.portfolioDetails.push({
            description: req.body[`photoDescription_${i}`] || "",
            category: req.body[`photoCategory_${i}`] || "general"
          });
        }
      }
    }

    await newUser.save();

    await sendVerificationEmail({
      to: newUser.email,
      name: newUser.name,
      token: verificationToken,
      req,
    });

    if (role === "mover") {
      sendMoverRegistrationEmail(newUser).catch(() => {});
    } else if (role === "seller") {
      sendSellerRegistrationEmail(newUser).catch(() => {});
    } else if (role === "landlord") {
      sendLandlordRegistrationEmail(newUser).catch(() => {});
    }

    res.status(201).json({
      message: "Registration successful! A verification email has been sent to your email. Please verify before logging in.",
      requiresVerification: true,
      email: newUser.email,
    });

  } catch (err) {
    console.error(" Registration error:", err);
    res.status(500).json({ error: err.message || "Registration failed" });
  }
});

// ====================== LOGIN ======================
router.post("/login", security.authLimiter, async (req, res) => {
  try {
    const { email, password, role } = req.body;

    console.log(" Login attempt:", { email, role });

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    let user;
    if (role) {
      user = await User.findOne({ email: normalizedEmail, role }).select("+password");
      console.log(" User found with role:", user ? "YES" : "NO");
      // If not found with specific role, try finding by email only
      if (!user) {
        user = await User.findOne({ email: normalizedEmail }).select("+password");
        console.log(" User found by email only:", user ? "YES" : "NO");
      }
    } else {
      // Fallback: prioritize admin/team roles first, otherwise return first matching user
      user = await User.findOne({ email: normalizedEmail, role: { $in: ["admin", "team"] } }).select("+password");
      console.log(" Admin/Team user found:", user ? "YES" : "NO");
      if (!user) {
        user = await User.findOne({ email: normalizedEmail }).select("+password");
        console.log(" Any user found:", user ? "YES" : "NO");
      }
    }

    if (!user) {
      console.log(" User not found for email:", normalizedEmail);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    console.log(" User found:", { email: user.email, role: user.role, isEmailVerified: user.isEmailVerified });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log(" Password invalid for:", normalizedEmail);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    console.log(" Password valid for:", normalizedEmail);

    // Email verification check - users must verify their email before logging in
    if (!user.isEmailVerified && user.role !== "admin" && user.role !== "team") {
      return res.status(403).json({
        error: "Please verify your email before logging in. Check your inbox for the verification link.",
        requiresVerification: true,
        email: user.email,
        role: user.role
      });
    }

    if (user.role === "mover" && !user.isApproved) {
      return res.status(403).json({
        error: " Your account is pending admin approval. You will be able to log in once approved."
      });
    }

    // Landlord/host/tourism providers don't require account approval - auto-approve on login
    // Only their property listings need admin approval
    if ((user.role === "landlord" || user.role === "host") && !user.isApproved) {
      user.isApproved = true;
      await user.save();
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: formatUserResponse(user),
    });

  } catch (err) {
    console.error(" Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

// ====================== GUEST SIGN‑IN ======================
router.post("/guest-signin", async (req, res) => {
  try {
    let { email, phone } = req.body;
    
    // Auto-generate for anonymous guest auto-login
    if (!email || !phone) {
      const randStr = crypto.randomBytes(4).toString('hex');
      email = `guest_${randStr}@guest.axxspace.com`;
      phone = `0000${randStr}`;
    }

    // Check if a guest user already exists with this email and phone
    let user = await User.findOne({ email, phone, role: "guest" }).select("+password");
    if (!user) {
      // Generate a simple 6‑digit numeric password
      const rawPassword = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      user = new User({
        name: email.split('@')[0],
        email,
        phone,
        password: hashedPassword,
        role: "guest",
        isEmailVerified: true,
        isApproved: true,
      });
      await user.save();
    }
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.status(200).json({
      token,
      user: formatUserResponse(user),
      role: "guest",
    });
  } catch (err) {
    console.error(" Guest sign‑in error:", err);
    res.status(500).json({ error: "Server error during guest sign‑in" });
  }
});

// ====================== GET ME ======================
router.get("/me", auth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ user: formatUserResponse(req.user) });
  } catch (err) {
    console.error(" Profile fetch error:", err);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// ====================== FORGOT PASSWORD ======================
router.post("/forgot-password", security.passwordResetLimiter, async (req, res) => {
  try {
    const { email, role, platform } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    let query = { email };
    if (role) {
      query.role = role;
    }
    const user = await User.findOne(query);

    // Always return the same message to prevent email enumeration
    if (!user) {
      return res.json({ message: " If that email exists, a reset link has been sent." });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetUrl = platform === "app"
      ? `axxlandlordportal://reset-password/${resetToken}`
      : `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    console.log(" Sending password reset email:");
    console.log("  From:", FROM_EMAIL);
    console.log("  To:", email);
    console.log("  Reset URL:", resetUrl);

    const sendResult = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: " Reset Your Axx Spaces Password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1f2937; padding: 20px; text-align: center;">
            <h1 style="color: #fbbf24; margin: 0;"> Password Reset</h1>
            <p style="color: #94a3b8; margin: 6px 0 0;">Axx Spaces</p>
          </div>
          <div style="background: white; padding: 32px; border: 1px solid #e5e7eb;">
            <p style="color: #1f2937; font-size: 15px;">Hi <strong>${user.name}</strong>,</p>
            <p style="color: #6b7280; font-size: 14px;">
              We received a request to reset your password. Click the button below to create a new password.
              This link expires in <strong>1 hour</strong>.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}"
                style="background: #2427fb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                 Reset My Password
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
              If you did not request this, ignore this email — your password will not change.<br/>
              Link expires in 1 hour.
            </p>
          </div>
        </div>
      `,
    });

    // Check for Resend API errors
    if (sendResult.error) {
      console.error(" Resend API error:", sendResult.error);
      throw new Error(sendResult.error.message || "Failed to send email via Resend");
    }

    // Log Resend's response so you can see exactly what happened
    console.log(" Resend response:", JSON.stringify(sendResult, null, 2));
    console.log(` Password reset email sent to: ${email}`);

    res.json({ message: " If that email exists, a reset link has been sent." });

  } catch (err) {
    console.error(" Forgot password error:", err);
    console.error(" Resend error details:", err?.response?.data || err?.message);
    res.status(500).json({ error: "Failed to send reset email" });
  }
});

// ====================== RESET PASSWORD ======================
router.post("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
      return res.status(400).json({ error: "Password must contain a mixture of both letters and numbers." });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: " Reset link is invalid or has expired." });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    console.log(` Password reset successfully for: ${user.email}`);
    res.json({ message: " Password reset successfully! You can now login." });

  } catch (err) {
    console.error(" Reset password error:", err);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// ====================== VERIFY EMAIL ======================
router.post("/verify-email/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: "Verification link is invalid or has expired." });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpiry = undefined;
    await user.save();

    // Send welcome email upon successful verification
    sendWelcomeEmail(user.email, user.name, user.role).catch(() => {});

    console.log(` Email verified successfully for: ${user.email} (role: ${user.role})`);
    res.json({
      success: true,
      message: "Email verified successfully! You can now log in.",
      role: user.role,
      email: user.email,
    });

  } catch (err) {
    console.error(" Email verification error:", err);
    res.status(500).json({ error: "Failed to verify email" });
  }
});

// Also handle direct GET request (e.g. if opened directly in browser)
router.get("/verify-email/:token", async (req, res) => {
  const { token } = req.params;
  const origin = req.get("origin");
  const frontendUrl = (origin && (origin.includes("localhost") || origin.includes("127.0.0.1")))
    ? origin
    : (process.env.FRONTEND_URL || "https://axxspace.com");
  return res.redirect(`${frontendUrl}/verify-email/${token}`);
});

// ====================== RESEND VERIFICATION EMAIL ======================
router.post("/resend-verification", async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    let query = { email: normalizedEmail };
    if (role) {
      query.role = role;
    }
    let user = await User.findOne(query);
    if (!user) {
      user = await User.findOne({ email: normalizedEmail });
    }

    if (!user) {
      return res.status(404).json({ error: "No account found with this email." });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ error: "This email is already verified. You can log in directly." });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpiry = Date.now() + 24 * 60 * 60 * 1000;

    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpiry = verificationExpiry;
    await user.save();

    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      token: verificationToken,
      req,
    });

    console.log(` Verification email resent to: ${user.email}`);
    res.json({ message: "Verification email sent successfully! Please check your inbox (and spam folder)." });

  } catch (err) {
    console.error(" Resend verification error:", err);
    res.status(500).json({ error: "Failed to send verification email" });
  }
});

// ====================== GOOGLE OAUTH ======================
router.post("/google", async (req, res) => {
  try {
    const { googleId, email, name, picture, landlordType, role } = req.body;

    if (!googleId || !email || !name) {
      return res.status(400).json({ error: "Google ID, email, and name are required" });
    }

    const targetRole = role || "member";

    // 1. Check if user exists by googleId (any role)
    let user = await User.findOne({ googleId });
    if (!user) {
      // 2. Check if user exists with this email
      user = await User.findOne({ email });
    }

    if (user) {
      if (!user.googleId) user.googleId = googleId;
      user.isGoogleUser = true;
      user.isEmailVerified = true;
      if (picture && !user.profileImage) user.profileImage = picture;

      // If user had generic 'user' or 'member' role and is signing in through a specific portal (e.g. host, agent, landlord, seller)
      if ((user.role === "user" || user.role === "member") && targetRole && targetRole !== "user" && targetRole !== "member") {
        user.role = targetRole;
      }

      // Auto-approve landlord & host accounts (listings are approved separately)
      if ((user.role === "landlord" || user.role === "host") && !user.isApproved) {
        user.isApproved = true;
      }

      await user.save();

      const token = jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );
      return res.json({ token, user: formatUserResponse(user) });
    }

    // 3. New member: create account automatically
    const autoApproved = ["member", "user", "seller", "landlord", "host"].includes(targetRole);
    const newUser = new User({
      name,
      email,
      googleId,
      isGoogleUser: true,
      isEmailVerified: true,
      phone: `google-${googleId.slice(0, 10)}`,
      profileImage: picture || "",
      password: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10),
      role: targetRole,
      isApproved: autoApproved,
      landlordType: targetRole === "landlord" && landlordType === "university" ? "university" : "general",
    });

    await newUser.save();

    const token = jwt.sign(
      { userId: newUser._id, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      token,
      user: formatUserResponse(newUser),
      requiresPhone: true,
      isNewMember: true,
    });

  } catch (err) {
    console.error(" Google OAuth error:", err);
    res.status(500).json({ error: err.message || "Google authentication failed" });
  }
});

// ====================== APPROVE TOURISM PROVIDER ======================
router.patch("/:id/approve-tourism-provider", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }
    const { approve } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isApproved: approve },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    if (approve) {
      await sendTourismApprovalEmail(user.email, user.name);
    }
    res.json({ success: true, message: `Tourism provider ${approve ? "approved" : "rejected"}`, user });
  } catch (err) {
    console.error(" Approve tourism provider error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ====================== APPROVE MOVER ======================
router.patch("/:id/approve-mover", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }
    const { approve } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isApproved: approve },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    if (approve) {
      await sendMoverApprovalEmail(user.email, user.name);
    }
    res.json({ success: true, message: `Mover ${approve ? "approved" : "rejected"}`, user });
  } catch (err) {
    console.error(" Approve mover error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;