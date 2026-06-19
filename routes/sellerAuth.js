import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { formatUserResponse } from "../utils/formatUser.js";

const router = express.Router();

// ============ SELLER REGISTER ============
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone, county } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existingEmail = await User.findOne({ email, role: "seller" });
    if (existingEmail) return res.status(400).json({ error: "Email already registered for a seller account" });

    const existingPhone = await User.findOne({ phone, role: "seller" });
    if (existingPhone) return res.status(400).json({ error: "Phone already registered for a seller account" });

    const hashedPassword = await bcrypt.hash(password, 12);

    const seller = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      county: county || "",
      role: "seller",
      isApproved: false,
    });

    await seller.save();

    res.status(201).json({
      success: true,
      message: "Seller account created! You can now login and upload materials. They will be visible after admin approval.",
    });
  } catch (error) {
    console.error("Seller register error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ SELLER LOGIN ============
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const seller = await User.findOne({ email, role: "seller" }).select("+password");
    if (!seller) {
      return res.status(401).json({ error: "No seller account found with this email" });
    }

    const isMatch = await bcrypt.compare(password, seller.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    const token = jwt.sign(
      { userId: seller._id, role: seller.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: formatUserResponse(seller),
    });
  } catch (error) {
    console.error("Seller login error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
