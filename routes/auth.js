import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import { protect as auth } from "../middleware/auth.js";
import { formatUserResponse } from "../utils/formatUser.js";
import { Resend } from "resend";
import { sendMoverRegistrationEmail, sendSellerRegistrationEmail, sendTourismApprovalEmail, sendMoverApprovalEmail } from "../utils/email.js";

const router = express.Router();
const resend = new Resend("re_6qT1yhNw_Ey9TNVw6T3HqCbBGjL4YzMBc");

// ====================== REGISTER ======================
router.post("/register", async (req, res) => {
  try {
    const {
      name, email, password, phone, role,
      county, services, vehicleType, experience
    } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: "Name, email, password, and phone are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    const newUser = new User({
      name, email, password: hashedPassword, phone,
      role: role || "landlord",
      emailVerificationToken: verificationToken,
      emailVerificationExpiry: verificationExpiry,
    });

    if (role === "mover") {
      newUser.county = county || "";
      newUser.services = services || [];
      newUser.vehicleType = vehicleType || "";
      newUser.experienceYears = experience || 0;
      newUser.isApproved = false;
    }

    await newUser.save();

    // Send email verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: email,
      subject: "📧 Verify Your Email - Axxspace",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0B2140; padding: 20px; text-align: center;">
            <h1 style="color: #fbbf24; margin: 0;">Axxspace</h1>
            <p style="color: #94a3b8; margin: 6px 0 0;">Kenya's Premier Platform</p>
          </div>
          <div style="background: white; padding: 32px; border: 1px solid #e5e7eb;">
            <p style="color: #1f2937; font-size: 15px;">Hi <strong>${name}</strong>,</p>
            <p style="color: #6b7280; font-size: 14px;">
              Thank you for registering with Axxspace! Please verify your email address to activate your account.
              This link expires in <strong>24 hours</strong>.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${verificationUrl}"
                style="background: #fbbf24; color: #0B2140; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                ✅ Verify My Email
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
              If you did not create an account with Axxspace, ignore this email.<br/>
              Link expires in 24 hours.
            </p>
          </div>
        </div>
      `,
    });

    // Send email notification for mover or seller registration
    if (role === "mover") {
      await sendMoverRegistrationEmail(newUser);
    } else if (role === "seller") {
      await sendSellerRegistrationEmail(newUser);
    }

    res.status(201).json({
      message: "Registration successful! Please check your email to verify your account.",
      requiresVerification: true,
    });

  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ error: err.message || "Registration failed" });
  }
});

// ====================== LOGIN ======================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // 🔒 MOVER APPROVAL GATEKEEPER
    if (user.role === "mover" && !user.isApproved) {
      return res.status(403).json({ 
        error: "⏳ Your account is pending admin approval. You will be able to log in once approved." 
      });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        _id: user._id, name: user.name, email: user.email,
        phone: user.phone, role: user.role, isApproved: user.isApproved
      },
    });

  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Server error during login" });
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
    console.error("❌ Profile fetch error:", err);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// ====================== FORGOT PASSWORD ======================
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.json({ message: "✅ If that email exists, a reset link has been sent." });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: email,
      subject: "🔐 Reset Your Axx Spaces Password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1f2937; padding: 20px; text-align: center;">
            <h1 style="color: #fbbf24; margin: 0;">🔐 Password Reset</h1>
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
                🔑 Reset My Password
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

    console.log(`📧 Password reset email sent to: ${email}`);
    res.json({ message: "✅ If that email exists, a reset link has been sent." });

  } catch (err) {
    console.error("❌ Forgot password error:", err);
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

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: "❌ Reset link is invalid or has expired." });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    console.log(`✅ Password reset successfully for: ${user.email}`);
    res.json({ message: "✅ Password reset successfully! You can now login." });

  } catch (err) {
    console.error("❌ Reset password error:", err);
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
      return res.status(400).json({ error: "❌ Verification link is invalid or has expired." });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpiry = undefined;
    await user.save();

    console.log(`✅ Email verified successfully for: ${user.email}`);
    res.json({ message: "✅ Email verified successfully! You can now login." });

  } catch (err) {
    console.error("❌ Email verification error:", err);
    res.status(500).json({ error: "Failed to verify email" });
  }
});

// ====================== RESEND VERIFICATION EMAIL ======================
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ error: "Email is already verified" });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpiry = verificationExpiry;
    await user.save();

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: email,
      subject: "📧 Verify Your Email - Axxspace",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0B2140; padding: 20px; text-align: center;">
            <h1 style="color: #fbbf24; margin: 0;">Axxspace</h1>
            <p style="color: #94a3b8; margin: 6px 0 0;">Kenya's Premier Platform</p>
          </div>
          <div style="background: white; padding: 32px; border: 1px solid #e5e7eb;">
            <p style="color: #1f2937; font-size: 15px;">Hi <strong>${user.name}</strong>,</p>
            <p style="color: #6b7280; font-size: 14px;">
              Please verify your email address to activate your account.
              This link expires in <strong>24 hours</strong>.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${verificationUrl}"
                style="background: #fbbf24; color: #0B2140; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                ✅ Verify My Email
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
              If you did not create an account with Axxspace, ignore this email.<br/>
              Link expires in 24 hours.
            </p>
          </div>
        </div>
      `,
    });

    console.log(`📧 Verification email resent to: ${email}`);
    res.json({ message: "✅ Verification email sent successfully!" });

  } catch (err) {
    console.error("❌ Resend verification error:", err);
    res.status(500).json({ error: "Failed to send verification email" });
  }
});

// ====================== GOOGLE OAUTH ======================
router.post("/google", async (req, res) => {
  try {
    const { googleId, email, name, picture } = req.body;

    if (!googleId || !email || !name) {
      return res.status(400).json({ error: "Google ID, email, and name are required" });
    }

    // Check if user exists with this Google ID
    let user = await User.findOne({ googleId });

    if (user) {
      // User exists, log them in
      const token = jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.json({
        token,
        user: formatUserResponse(user),
      });
    }

    // Check if user exists with this email (but no Google ID)
    user = await User.findOne({ email });

    if (user) {
      // Link Google account to existing user
      user.googleId = googleId;
      user.isGoogleUser = true;
      user.isEmailVerified = true; // Google emails are verified
      await user.save();

      const token = jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.json({
        token,
        user: formatUserResponse(user),
      });
    }

    // Create new user with Google account
    const newUser = new User({
      name,
      email,
      googleId,
      isGoogleUser: true,
      isEmailVerified: true, // Google emails are verified
      phone: "", // Will need to be filled later
      password: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10), // Random password
      role: "landlord",
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
      requiresPhone: true, // Indicate that phone number needs to be added
    });

  } catch (err) {
    console.error("❌ Google OAuth error:", err);
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
    res.json({ success: true, message: `Tourism provider ${approve ? 'approved' : 'rejected'}`, user });
  } catch (err) {
    console.error("❌ Approve tourism provider error:", err);
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
    res.json({ success: true, message: `Mover ${approve ? 'approved' : 'rejected'}`, user });
  } catch (err) {
    console.error("❌ Approve mover error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;