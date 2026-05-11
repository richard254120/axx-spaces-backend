import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// ✅ POST /auth/register - Register new user (landlord or mover)
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone, role, county, services, vehicleType, experience } = req.body;

    // ✅ Validate required fields
    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: "Name, email, password, and phone are required" });
    }

    // ✅ Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Create user object
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      role: role || "landlord",
    });

    // ✅ Add mover-specific fields if registering as mover
    if (role === "mover") {
      newUser.county = county || "";
      newUser.services = services || [];
      newUser.vehicleType = vehicleType || "";
      newUser.experienceYears = experience || 0;
    }

    // ✅ Save user to database
    await newUser.save();

    // ✅ Generate JWT token
    const token = jwt.sign(
      { userId: newUser._id, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ Return token and user data
    res.json({
      token,
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        county: newUser.county,
        services: newUser.services,
        vehicleType: newUser.vehicleType,
        experienceYears: newUser.experienceYears,
      },
    });

  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ error: err.message || "Registration failed" });
  }
});

// ✅ POST /auth/login - Login user
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // ✅ Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // ✅ Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // ✅ Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ Return token and user data
    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        county: user.county,
        services: user.services,
        vehicleType: user.vehicleType,
        experienceYears: user.experienceYears,
      },
    });

  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ✅ GET /auth/me - Get current user (protected route)
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        county: user.county,
        services: user.services,
        vehicleType: user.vehicleType,
        experienceYears: user.experienceYears,
      },
    });

  } catch (err) {
    console.error("❌ Get user error:", err);
    res.status(500).json({ error: "Failed to get user" });
  }
});

// ✅ POST /auth/forgot-password - Forgot password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // TODO: Send reset email (implement nodemailer)
    res.json({ message: "Password reset email sent" });

  } catch (err) {
    console.error("❌ Forgot password error:", err);
    res.status(500).json({ error: "Failed to process request" });
  }
});

export default router;