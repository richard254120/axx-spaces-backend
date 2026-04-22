import express from "express";
import Property from "../models/Property.js";
import multer from "multer";
import cloudinaryStorage from "multer-storage-cloudinary";
import { v2 as cloudinary } from "cloudinary";

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
   MULTER + CLOUDINARY STORAGE
========================= */
const storage = cloudinaryStorage({
  cloudinary,
  params: {
    folder: "axx-spaces",
    allowed_formats: ["jpg", "png", "jpeg"],
    transformation: [{ width: 1000, crop: "limit" }],
  },
});

const upload = multer({ storage });

/* =========================
   CREATE PROPERTY
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

    if (!req.body.title || !req.body.county || !req.body.price || !req.body.type) {
      return res.status(400).json({ error: "Missing required fields" });
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

      // ✅ ALWAYS store Cloudinary secure URL
      image: req.file ? req.file.path : null,

      status: "pending",
    });

    const saved = await newProperty.save();

    res.status(201).json({
      message: "Property submitted ✔",
      data: saved,
    });

  } catch (err) {
    console.error("CREATE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET PENDING
========================= */
router.get("/properties/pending", async (req, res) => {
  try {
    const pending = await Property.find({ status: "pending" })
      .sort({ createdAt: -1 });

    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   APPROVE PROPERTY
========================= */
router.patch("/properties/:id/approve", async (req, res) => {
  try {
    const updated = await Property.findByIdAndUpdate(
      req.params.id,
      { status: "approved" },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   REJECT PROPERTY
========================= */
router.patch("/properties/:id/reject", async (req, res) => {
  try {
    const updated = await Property.findByIdAndUpdate(
      req.params.id,
      { status: "rejected" },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET APPROVED (FILTER SAFE)
========================= */
router.get("/properties/approved", async (req, res) => {
  try {
    const { county, area, price, type, bedrooms } = req.query;

    let filter = { status: "approved" };

    if (county) filter.county = { $regex: county, $options: "i" };
    if (area) filter.area = { $regex: area, $options: "i" };
    if (type) filter.type = type;

    if (bedrooms && !isNaN(bedrooms)) {
      filter.bedrooms = Number(bedrooms);
    }

    if (price && !isNaN(price)) {
      filter.price = { $lte: Number(price) };
    }

    const properties = await Property.find(filter)
      .sort({ createdAt: -1 });

    res.json(properties);

  } catch (err) {
    console.error("FETCH ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;