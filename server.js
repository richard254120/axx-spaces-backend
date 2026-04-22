import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import propertyRoutes from "./routes/property.js";

dotenv.config();

const app = express();

/* =========================
   CORS
========================= */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PATCH", "DELETE"],
}));

/* =========================
   BODY PARSER
========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   ROUTES
========================= */
app.use("/api", propertyRoutes);

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.send("AXX Spaces Backend Running ✔");
});

/* =========================
   DB CONNECTION (FIXED)
========================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
    console.log("❌ DB Error:", err.message);
    process.exit(1);
  });

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});