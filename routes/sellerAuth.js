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
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    const seller = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      county: county || "",
      role: "seller",
      isApproved: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpiry: verificationExpiry,
      isEmailVerified: false,
    });

    await seller.save();

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

    if (resend) {
      await resend.emails.send({
        from: FROM_EMAIL,
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
                Thank you for registering as a Seller on Axxspace! Please verify your email address to activate your account.
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
    } else {
      console.log("📧 [Email Mock] Would send verification email to:", email);
    }

    res.status(201).json({
      success: true,
      message: "Seller account created! Please check your email to verify your account.",
      requiresVerification: true,
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

    if (!seller.isEmailVerified) {
      return res.status(403).json({
        error: "📧 Please verify your email before logging in. Check your inbox for the verification link.",
        requiresVerification: true,
        email: seller.email,
        role: "seller"
      });
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
