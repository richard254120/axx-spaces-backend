import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import authRoutes from "./routes/auth.js";
import propertyRoutes from "./routes/property.js";

dotenv.config();

const app = express();

/* ======================
   BASIC MIDDLEWARE
====================== */
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ======================
   ROUTES (SIMPLE RESTORE)
====================== */
app.use("/api", authRoutes);
app.use("/api", propertyRoutes);

/* ======================
   TEST ROUTE
====================== */
app.get("/", (req, res) => {
  res.send("Backend Running ✔");
});

/* ======================
   DB CONNECTION
====================== */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ DB Error:", err.message));

const PORT = process.env.PORT || 1000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});