import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Resend } from "resend";
import dotenv from "dotenv";
import User from "../models/User.js";
import { formatUserResponse } from "../utils/formatUser.js";

const router = express.Router();

dotenv.config();

// Initialize Resend only if API key is available
let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ? `AxxSpace <${process.env.RESEND_FROM_EMAIL}>` : "Axxspace <admin@axxspace.com>";

// ============ SELLER REGISTER ============
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone, county } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
      return res.status(400).json({ error: "Password must contain a mixture of both letters and numbers." });
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
      isEmailVerified: true,
    });

    await seller.save();

    res.status(201).json({
      success: true,
      message: "Seller account created! You can now log in with your credentials.",
      requiresVerification: false,
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

    // Email verification check disabled - users can login immediately after registration
    // if (!seller.isEmailVerified) {
    //   return res.status(403).json({
    //     error: " Please verify your email before logging in. Check your inbox for the verification link.",
    //     requiresVerification: true,
    //     email: seller.email,
    //     role: "seller"
    //   });
    // }

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
