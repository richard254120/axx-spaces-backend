import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import { protect as auth } from "../middleware/enhancedAuth.js";
import { passwordValidationMiddleware } from "../middleware/passwordValidator.js";
import { formatUserResponse } from "../utils/formatUser.js";
import { Resend } from "resend";

const router = express.Router();
const resend = new Resend("re_6qT1yhNw_Ey9TNVw6T3HqCbBGjL4YzMBc");

// ====================== REGISTER ======================
router.post("/register", passwordValidationMiddleware, async (req, res) => {
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

    const newUser = new User({
      name, email, password: hashedPassword, phone,
      role: role || "landlord",
    });

    if (role === "mover") {
      newUser.county = county || "";
      newUser.services = services || [];
      newUser.vehicleType = vehicleType || "";
      newUser.experienceYears = experience || 0;
      newUser.isApproved = false;
    }

    await newUser.save();

    const token = jwt.sign(
      { userId: newUser._id, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      token,
      user: formatUserResponse(newUser),
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

    // 🔒 MOVER & TOURISM PROVIDER APPROVAL GATEKEEPER
    if ((user.role === "mover" || user.role === "tourism_provider") && !user.isApproved) {
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
      subject: "🔐 Reset Your Axxspace Password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1f2937; padding: 20px; text-align: center;">
            <h1 style="color: #fbbf24; margin: 0;">🔐 Password Reset</h1>
            <p style="color: #94a3b8; margin: 6px 0 0;">Axxspace</p>
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
router.post("/reset-password/:token", passwordValidationMiddleware, async (req, res) => {
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

// ====================== GET PENDING TOURISM PROVIDERS ======================
router.get("/pending-tourism-providers", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const pendingProviders = await User.find({
      role: "tourism_provider",
      isApproved: false,
    }).select("name email phone role createdAt");

    res.json(pendingProviders);
  } catch (err) {
    console.error("❌ Failed to fetch pending tourism providers:", err);
    res.status(500).json({ error: "Failed to fetch pending tourism providers" });
  }
});

// ====================== APPROVE TOURISM PROVIDER ======================
router.patch("/:userId/approve-tourism-provider", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { userId } = req.params;
    const { approve } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role !== "tourism_provider") {
      return res.status(400).json({ error: "User is not a tourism provider" });
    }

    if (approve) {
      user.isApproved = true;
      await user.save();
      console.log(`✅ Tourism provider approved: ${user.email}`);
      res.json({ message: "Tourism provider approved successfully" });
    } else {
      await User.findByIdAndDelete(userId);
      console.log(`✅ Tourism provider rejected and deleted: ${user.email}`);
      res.json({ message: "Tourism provider rejected and deleted" });
    }
  } catch (err) {
    console.error("❌ Failed to approve tourism provider:", err);
    res.status(500).json({ error: "Failed to approve tourism provider" });
  }
});

export default router;