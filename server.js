import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

import propertyRoutes from "./routes/property.js";
import authRoutes from "./routes/auth.js";

// Fix for ES modules __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

/* =========================
   CORS
========================= */
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://axx-spaces-frontend.vercel.app"
  ],
  methods: ["GET", "POST", "PATCH", "DELETE"],
  credentials: true
}));

/* =========================
   BODY PARSER
========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   STATIC FILES - UPLOADS
========================= */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Create uploads folder if it doesn't exist
import fs from "fs";
if (!fs.existsSync(path.join(__dirname, "uploads"))) {
  fs.mkdirSync(path.join(__dirname, "uploads"));
}

/* =========================
   ROUTES
========================= */
app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.send("Axx Spaces Backend is running ✔");
});

/* =========================
   DB CONNECTION
========================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
    console.log("❌ DB Error:", err.message);
    process.exit(1);
  });

const PORT = process.env.PORT || 1000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});