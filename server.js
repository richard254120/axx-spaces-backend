import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import jobRoutes from "./routes/jobs.js";
import authRoutes from "./routes/auth.js";
import propertyRoutes from "./routes/property.js";
import paymentRoutes from "./routes/payment.js";
import moverRoutes from "./routes/moverRoutes.js";
import materialRoutes from "./routes/materials.js";
import verificationRoutes from "./routes/verification.js";
import sellerAuthRoutes from "./routes/sellerAuth.js";

dotenv.config();

const app = express();

// ====================== SECURITY MIDDLEWARE ======================
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    process.env.FRONTEND_URL || "https://axx-spaces.vercel.app",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Set-Cookie"],
}));

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

console.log("✅ Security middleware configured");

// ====================== MONGODB CONNECTION ======================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err.message));

// ====================== ROUTES ======================
app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/movers", moverRoutes);
app.use("/api/materials", materialRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/seller-auth", sellerAuthRoutes);
app.use("/api/jobs", jobRoutes);
app.get("/api/health", (req, res) => res.json({ status: "OK", timestamp: new Date() }));

// ====================== 404 HANDLER ======================
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ====================== START SERVER ======================
const PORT = process.env.PORT || 1000;
app.listen(PORT, () => {
  console.log("==================================");
  console.log("🚀 AXX SPACES SERVER STARTED");
  console.log("==================================");
  console.log(`📍 Port: ${PORT}`);
  console.log("🔒 Security: Helmet + Rate Limit + HttpOnly Cookies");
});