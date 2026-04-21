import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";

import propertyRoutes from "./routes/property.js";

dotenv.config();

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors({
  origin: "*",
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   STATIC FILES (IMAGES)
========================= */
app.use("/uploads", express.static("uploads"));

/* =========================
   ROUTES
========================= */
app.use("/", propertyRoutes);

/* =========================
   MONGODB CONNECTION
========================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ DB Error:", err));

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});