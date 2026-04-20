import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import propertyRoutes from "./routes/property.js";

dotenv.config();

const app = express();

/* =========================
   MIDDLEWARE
========================= */
// Allows frontend access - set to "*" for development flexibility
app.use(cors({
  origin: "*"
}));

app.use(express.json());

// Serve uploaded images from the 'uploads' directory
app.use("/uploads", express.static("uploads"));

/* =========================
   MONGODB ATLAS CONNECTION
========================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Atlas Connected");
  })
  .catch((err) => {
    console.log("❌ Mongo Error:", err);
  });

/* =========================
   ROUTES
========================= */
app.use("/api", propertyRoutes);

/* =========================
   TEST ROUTE
========================= */
app.get("/", (req, res) => {
  res.send("API Running 🚀");
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});