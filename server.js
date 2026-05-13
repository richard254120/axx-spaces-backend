import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import nodemailer from "nodemailer";

import authRoutes from "./routes/auth.js";
import propertyRoutes from "./routes/property.js";
import paymentRoutes from "./routes/payment.js";
import moverRoutes from "./routes/moverRoutes.js";

dotenv.config();

const app = express();

app.use(cors({ origin: "*", credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

console.log("✅ Middleware configured");

// ====================== MAILER SETUP ======================
const ADMIN_EMAIL = "ogudarichard254@gmail.com";
const EMAIL_PASS = "uzqbcuzrzhttzeyl";

// ✅ Using port 465 with SSL instead of default SMTP (bypasses Render port blocking)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // SSL
  auth: {
    user: ADMIN_EMAIL,
    pass: EMAIL_PASS,
  },
});

// ✅ Test email route
app.get("/api/test-email", async (req, res) => {
  try {
    await transporter.sendMail({
      from: ADMIN_EMAIL,
      to: ADMIN_EMAIL,
      subject: "✅ Test from Render - Axx Spaces",
      text: "If you see this, Render email is working!",
    });
    res.json({ success: true, message: "✅ Email sent! Check your Gmail inbox." });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ✅ Export so property.js can use it
export const sendPropertyEmail = async (property, owner) => {
  try {
    await transporter.sendMail({
      from: `"Axx Spaces" <${ADMIN_EMAIL}>`,
      to: ADMIN_EMAIL,
      subject: `🏠 New Property Submitted — ${property.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1f2937; padding: 20px; text-align: center;">
            <h1 style="color: #fbbf24; margin: 0;">🏠 New Property Submitted</h1>
          </div>
          <div style="background: white; padding: 24px; border: 1px solid #e5e7eb;">
            <table style="width: 100%; font-size: 14px;">
              <tr><td style="color: #6b7280; padding: 8px 0;">Title</td><td style="font-weight:bold;">${property.title}</td></tr>
              <tr><td style="color: #6b7280; padding: 8px 0;">County</td><td>${property.county}</td></tr>
              <tr><td style="color: #6b7280; padding: 8px 0;">Location</td><td>${property.location || "N/A"}</td></tr>
              <tr><td style="color: #6b7280; padding: 8px 0;">Type</td><td>${property.propertyType || "N/A"}</td></tr>
              <tr><td style="color: #6b7280; padding: 8px 0;">Price</td><td style="color:#22c55e;font-weight:bold;">KSh ${Number(property.price).toLocaleString()} / month</td></tr>
              <tr><td style="color: #6b7280; padding: 8px 0;">Landlord</td><td>${owner?.name || "N/A"}</td></tr>
              <tr><td style="color: #6b7280; padding: 8px 0;">Email</td><td>${owner?.email || "N/A"}</td></tr>
              <tr><td style="color: #6b7280; padding: 8px 0;">Phone</td><td>${owner?.phone || "N/A"}</td></tr>
              <tr><td style="color: #6b7280; padding: 8px 0;">Submitted</td><td>${new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}</td></tr>
            </table>
            <div style="margin-top: 24px; text-align: center;">
              <a href="https://axx-spaces.vercel.app/dashboard" style="background:#fbbf24;color:#000;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
                ✅ Review &amp; Approve Property
              </a>
            </div>
          </div>
        </div>
      `,
    });
    console.log(`✅ Email sent for property: ${property.title}`);
  } catch (err) {
    console.error("❌ Email failed:", err.message);
  }
};

// ====================== DATABASE ======================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => {
    console.error("❌ MongoDB error:", err);
    process.exit(1);
  });

// ====================== ROUTES ======================
app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/movers", moverRoutes);

app.get("/api/health", (req, res) => res.json({ status: "OK" }));

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

const PORT = process.env.PORT || 1000;
app.listen(PORT, () => {
  console.log("==================================");
  console.log("🚀 AXX SPACES SERVER STARTED");
  console.log("==================================");
  console.log(`📍 Port: ${PORT}`);
  console.log("🚚 Mover Routes: Ready");
  console.log(`📧 Email configured for: ${ADMIN_EMAIL}`);
});