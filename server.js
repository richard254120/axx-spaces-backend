import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import propertyRoutes from "./routes/property.js";

dotenv.config();

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PATCH", "DELETE"],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", propertyRoutes);

app.get("/", (req, res) => {
  res.send("Backend running ✔");
});

/* =========================
   FIXED MONGO CONNECTION
========================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.log("❌ DB Error:", err.message);
  });

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});