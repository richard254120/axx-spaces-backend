import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

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
  console.warn("⚠️ Email credentials not configured");
}

// ✅ UPDATED REGISTRATION ROUTE
router.post("/register", async (req, res) => {
  try {
    // Destructure all possible fields from the frontend
    const { 
      name, email, password, phone, 
      role, county, experience, services 
    } = req.body;

    console.log("📝 Register attempt:", { name, email, role });

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: "❌ All basic fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "❌ Password must be at least 6 characters" });
    }

    // Check for duplicates
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ error: "❌ Email already registered" });
    }

    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({ error: "❌ Phone number already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with standard AND mover fields
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phone: phone.trim(),
      // New Logic
      role: role || "user",
      isApproved: role === "mover" ? false : true, // Movers need admin approval
      county: county || "",
      experienceYears: experience || 0,
      services: services || [],
    });

    await user.save();
    console.log("✅ User created:", user._id, "Role:", user.role);

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      message: "✅ Registration successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isApproved: user.isApproved
      },
    });
  } catch (error) {
    console.error("❌ Register error:", error);
    res.status(500).json({ error: error.message || "Registration failed" });
  }
});

// ✅ UPDATED LOGIN ROUTE (Includes Role in response)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("🔐 Login attempt:", email);

    if (!email || !password) {
      return res.status(400).json({ error: "❌ Email and password required" });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ error: "❌ Invalid email or password" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "❌ Invalid email or password" });
    }

    console.log("✅ Login successful:", user._id);

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
        role: user.role, // Added so frontend knows where to redirect
        isApproved: user.isApproved
      },
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ error: error.message || "Login failed" });
  }
});

// ... (forgot-password, reset-password, and /me routes stay the same)

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "❌ Email required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "❌ User not found" });

    if (!transporter) return res.status(500).json({ error: "❌ Email service not configured" });

    const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "🔐 Axx Spaces - Password Reset",
      html: `<h2>Password Reset</h2><p><a href="${resetLink}">Reset Password</a></p>`,
    });

    res.json({ success: true, message: "✅ Password reset link sent" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "❌ Token and password required" });
    if (password.length < 6) return res.status(400).json({ error: "❌ Password must be at least 6 characters" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "❌ User not found" });

    user.password = await bcrypt.hash(password, 10);
    await user.save();
    res.json({ success: true, message: "✅ Password reset successful" });
  } catch (error) {
    res.status(400).json({ error: "❌ Invalid or expired token" });
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;