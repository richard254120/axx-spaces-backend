import express from "express";
import Property from "../models/Property.js";
import multer from "multer";
import pkg from "multer-storage-cloudinary";
import { v2 as cloudinary } from "cloudinary";

const { CloudinaryStorage } = pkg;

const router = express.Router();

/* =========================
   CLOUDINARY CONFIG
========================= */
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

/* =========================
   FIXED CLOUDINARY STORAGE
========================= */
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: "axx-spaces",
      allowed_formats: ["jpg", "jpeg", "png"],
      public_id: Date.now() + "-" + file.originalname,
    };
  },
});

const upload = multer({ storage });

/* =========================
   CREATE PROPERTY (UPLOAD FIXED)
========================= */
router.post("/properties", upload.single("image"), async (req, res) => {
  try {
    let amenities = [];

    if (req.body.amenities) {
      try {
        amenities = JSON.parse(req.body.amenities);
      } catch {
        amenities = [];
      }
    }

    const newProperty = new Property({
      title: req.body.title,
      county: req.body.county,
      area: req.body.area,
      price: Number(req.body.price),
      deposit: req.body.deposit,
      type: req.body.type,
      bedrooms: req.body.bedrooms,
      bathrooms: req.body.bathrooms,
      description: req.body.description,
      phone: req.body.phone,

      lat: req.body.lat || null,
      lng: req.body.lng || null,

      amenities,

      // ✅ FIX: Cloudinary URL
      image: req.file ? req.file.path : null,

      status: "pending",
    });

    const saved = await newProperty.save();

    res.status(201).json({
      message: "Property uploaded successfully ✔",
      data: saved,
    });

  } catch (err) {
    console.log("UPLOAD ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET APPROVED
========================= */
router.get("/properties/approved", async (req, res) => {
  try {
    const properties = await Property.find({ status: "approved" })
      .sort({ createdAt: -1 });

    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   PENDING
========================= */
router.get("/properties/pending", async (req, res) => {
  try {
    const data = await Property.find({ status: "pending" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   APPROVE
========================= */
router.patch("/properties/:id/approve", async (req, res) => {
  const updated = await Property.findByIdAndUpdate(
    req.params.id,
    { status: "approved" },
    { new: true }
  );

  res.json(updated);
});

/* =========================
   REJECT
========================= */
router.patch("/properties/:id/reject", async (req, res) => {
  const updated = await Property.findByIdAndUpdate(
    req.params.id,
    { status: "rejected" },
    { new: true }
  );

  res.json(updated);
});

export default router;