import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

transporter.sendMail({
  from: process.env.EMAIL_USER,
  to: process.env.EMAIL_USER,
  subject: "✅ Axxspace Test Email",
  text: "Email is working correctly!",
}).then(() => {
  console.log("✅ EMAIL SENT SUCCESSFULLY");
}).catch((err) => {
  console.error("❌ EMAIL FAILED:", err.message);
});
