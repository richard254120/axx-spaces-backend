import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";

import propertyRoutes from "./routes/property.js";

dotenv.config();

const app = express();

/* =========================
   CORS (FIXED FOR MOBILE + NETLIFY)
========================= */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PATCH", "DELETE"],
}));

/* =========================
   BODY PARSERS
========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   STATIC FILES (IMAGES)
========================= */
app.use("/uploads", express.static("uploads"));

/* =========================
   ROUTES
========================= */
app.use("/api", propertyRoutes); // 🔥 IMPORTANT CHANGE

/* =========================
   HEALTH CHECK (DEBUG TOOL)
========================= */
app.get("/", (req, res) => {
  res.send("AXX Spaces Backend Running ✔");
});

/* =========================
   MONGODB CONNECTION
========================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
    console.log("❌ DB Error:", err);
    process.exit(1);
  });

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});