import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Resend } from "resend";

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

// ====================== RESEND EMAIL SETUP ======================
const resend = new Resend("re_6qT1yhNw_Ey9TNVw6T3HqCbBGjL4YzMBc");

// ✅ Test email route
app.get("/api/test-email", async (req, res) => {
  try {
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "ogudarichard254@gmail.com",
      subject: "✅ Test from Render - Axx Spaces",
      html: "<p>If you see this, <strong>Render email is working!</strong></p>",
    });
    res.json({ success: true, message: "✅ Email sent! Check your Gmail inbox." });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ✅ Export so property.js can use it
export const sendPropertyEmail = async (property, owner) => {
  try {
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "ogudarichard254@gmail.com",
      subject: `🏠 New Property Submitted — ${property.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1f2937; padding: 20px; text-align: center;">
            <h1 style="color: #fbbf24; margin: 0;">🏠 New Property Submitted</h1>
            <p style="color: #94a3b8; margin: 6px 0 0;">Axx Spaces Admin Notification</p>
          </div>
          <div style="background: white; padding: 24px; border: 1px solid #e5e7eb;">
            <h2 style="color: #1f2937; font-size: 16px;">Property Details</h2>
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="color: #6b7280; padding: 8px 0; width: 130px;">Title</td>
                <td style="font-weight:bold;">${property.title}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="color: #6b7280; padding: 8px 0;">County</td>
                <td>${property.county}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="color: #6b7280; padding: 8px 0;">Location</td>
                <td>${property.location || "N/A"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="color: #6b7280; padding: 8px 0;">Type</td>
                <td>${property.propertyType || "N/A"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="color: #6b7280; padding: 8px 0;">Price</td>
                <td style="color:#22c55e;font-weight:bold;">KSh ${Number(property.price).toLocaleString()} / month</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="color: #6b7280; padding: 8px 0;">Bedrooms</td>
                <td>${property.bedrooms || "N/A"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="color: #6b7280; padding: 8px 0;">Status</td>
                <td><span style="background:#fef3c7;color:#d97706;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:bold;">⏳ PENDING</span></td>
              </tr>
              <tr>
                <td style="color: #6b7280; padding: 8px 0;">Submitted</td>
                <td>${new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}</td>
              </tr>
            </table>

            <h2 style="color: #1f2937; font-size: 16px; margin-top: 20px;">Landlord Details</h2>
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="color: #6b7280; padding: 8px 0; width: 130px;">Name</td>
                <td style="font-weight:bold;">${owner?.name || "N/A"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="color: #6b7280; padding: 8px 0;">Email</td>
                <td>${owner?.email || "N/A"}</td>
              </tr>
              <tr>
                <td style="color: #6b7280; padding: 8px 0;">Phone</td>
                <td>${owner?.phone || "N/A"}</td>
              </tr>
            </table>

            <div style="margin-top: 28px; text-align: center;">
              <a href="https://axx-spaces.vercel.app/dashboard" 
                style="background:#fbbf24;color:#000;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
                ✅ Review &amp; Approve Property
              </a>
            </div>
            <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:20px;">
              Property ID: ${property._id}
            </p>
          </div>
        </div>
      `,
    });
    console.log(`✅ Email sent via Resend for: ${property.title}`);
  } catch (err) {
    console.error("❌ Resend email failed:", err.message);
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
  console.log("📧 Email: Resend configured");
});