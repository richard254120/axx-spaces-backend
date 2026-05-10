import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { 
      name, email, password, phone, 
      role, county, experience, vehicleType, services 
    } = req.body;

    console.log("📝 Registering:", { email, role });

    // 1. Basic Validation
    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: "❌ Basic fields are required" });
    }

    // 2. Check Duplicates
    const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ error: "❌ Email or Phone already exists" });
    }

    // 3. Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Create User with ALL fields from your model
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phone: phone.trim(),
      role: role || "user",
      // Mover-specific data logic
      isApproved: role === "mover" ? false : true,
      county: county || "",
      experienceYears: experience || 0,
      vehicleType: vehicleType || "Pickup",
      services: services || [],
    });

    await user.save();
    console.log("✅ User Saved with Role:", user.role);

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        isApproved: user.isApproved
      }
    });
  } catch (error) {
    console.error("❌ Register error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// LOGIN ROUTE
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Explicitly select password and role for validation
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "❌ Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        isApproved: user.isApproved
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;