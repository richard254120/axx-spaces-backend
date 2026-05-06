import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// ============ NODEMAILER CONFIG ============
let transporter = null;

if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  transporter.verify((error, success) => {
    if (error) {
      console.error("⚠️ Email config warning:", error.message);
    } else {
      console.log("✅ Email service ready");
    }
  });
} else {
  console.warn("⚠️ Email credentials not found - email functionality disabled");
}

// ============ REGISTER ============
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    console.log("\n📝 REGISTER REQUEST RECEIVED");
    console.log("📦 Payload:", { name, email, password: "***", phone });

    // Validation
    if (!name || !email || !password || !phone) {
      console.log("❌ Missing required fields");
      return res.status(400).json({ error: "❌ All fields are required" });
    }

    console.log("✅ All required fields present");

    if (password.length < 6) {
      console.log("❌ Password too short");
      return res.status(400).json({ error: "❌ Password must be at least 6 characters" });
    }

    console.log("✅ Password validation passed");

    // Check if user exists
    console.log("🔍 Checking if email already exists:", email);
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      console.log("❌ Email already registered");
      return res.status(400).json({ error: "❌ Email already registered" });
    }
    console.log("✅ Email is unique");

    console.log("🔍 Checking if phone already exists:", phone);
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      console.log("❌ Phone already registered");
      return res.status(400).json({ error: "❌ Phone number already registered" });
    }
    console.log("✅ Phone is unique");

    // Hash password
    console.log("🔐 Hashing password...");
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("✅ Password hashed");

    // Create user object
    console.log("👤 Creating user object...");
    const userObj = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phone: phone.trim(),
    };
    console.log("📋 User object:", { ...userObj, password: "***" });

    // Create user
    const user = new User(userObj);
    console.log("📝 User instance created");

    // Validate before save
    console.log("✔️ Validating user schema...");
    try {
      await user.validate();
      console.log("✅ User validation passed");
    } catch (validateError) {
      console.error("❌ VALIDATION ERROR:", validateError.message);
      console.error("❌ VALIDATION DETAILS:", validateError.errors);
      return res.status(400).json({ 
        error: `Validation failed: ${validateError.message}`,
        details: Object.keys(validateError.errors || {})
      });
    }

    // Save user
    console.log("💾 Saving user to MongoDB...");
    await user.save();
    console.log("✅ User saved:", user._id);

    // Generate JWT
    console.log("🔑 Generating JWT token...");
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    console.log("✅ JWT token generated");

    console.log("✅ REGISTRATION SUCCESSFUL\n");

    res.status(201).json({
      success: true,
      message: "✅ Registration successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("\n❌ REGISTER ERROR");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error details:", error);
    if (error.errors) {
      console.error("Field errors:", error.errors);
    }
    console.error("\n");
    
    res.status(500).json({ 
      error: error.message || "Registration failed",
      type: error.name
    });
  }
});

// ============ LOGIN ============
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("🔐 Login attempt:", email);

    if (!email || !password) {
      return res.status(400).json({ error: "❌ Email and password required" });
    }

    // Find user
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ error: "❌ Invalid email or password" });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "❌ Invalid email or password" });
    }

    console.log("✅ Login successful:", user._id);

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "✅ Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ error: error.message || "Login failed" });
  }
});

// ============ FORGOT PASSWORD ============
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "❌ Email required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "❌ User not found" });
    }

    if (!transporter) {
      return res.status(500).json({ 
        error: "❌ Email service not configured" 
      });
    }

    const resetToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "🔐 Axx Spaces - Password Reset",
      html: `
        <h2>Password Reset Request</h2>
        <p>Click the link below to reset your password (expires in 1 hour):</p>
        <a href="${resetLink}" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <p>Or copy this link: ${resetLink}</p>
      `,
    });

    res.json({
      success: true,
      message: "✅ Password reset link sent to your email",
    });
  } catch (error) {
    console.error("❌ Forgot password error:", error);
    res.status(500).json({ error: error.message || "Failed to send reset email" });
  }
});

// ============ RESET PASSWORD ============
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: "❌ Token and password required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "❌ Password must be at least 6 characters" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: "❌ User not found" });
    }

    user.password = await bcrypt.hash(password, 10);
    await user.save();

    res.json({
      success: true,
      message: "✅ Password reset successful",
    });
  } catch (error) {
    console.error("❌ Reset password error:", error);
    res.status(400).json({ error: "❌ Invalid or expired token" });
  }
});

// ============ GET CURRENT USER ============
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (error) {
    console.error("❌ Get user error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;