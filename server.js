import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import authRoutes from "./routes/auth.js";
import propertyRoutes from "./routes/property.js";

dotenv.config();

const app = express();

/* ======================
   MIDDLEWARE
====================== */
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ======================
   ROUTES
====================== */
app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);

/* ======================
   HEALTH CHECK
====================== */
app.get("/", (req, res) => {
  res.send("AXX Spaces Backend Running ✔");
});

/* ======================
   DATABASE
====================== */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.log("❌ DB Error:", err.message);
  });

/* ======================
   START SERVER
====================== */
const PORT = process.env.PORT || 1000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});