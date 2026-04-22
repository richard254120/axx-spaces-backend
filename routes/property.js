import express from "express";
import Property from "../models/Property.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

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
   STORAGE CONFIG (FIXED)
========================= */
const storage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: "axx-spaces",
    allowed_formats: ["jpg", "png", "jpeg"],
  }),
});

const upload = multer({ storage });

/* =========================
   CREATE PROPERTY
========================= */
router.post("/properties", upload.single("image"), async (req, res) => {
  try {
    const amenities = req.body.amenities
      ? JSON.parse(req.body.amenities)
      : [];

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

      // ✅ Cloudinary URL FIX
      image: req.file?.path || null,

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
    const data = await Property.find({ status: "pending" }).sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   APPROVE
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
   REJECT
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
   GET APPROVED
========================= */
router.get("/properties/approved", async (req, res) => {
  try {
    const filter = { status: "approved" };

    if (req.query.county) {
      filter.county = { $regex: req.query.county, $options: "i" };
    }

    const data = await Property.find(filter).sort({ createdAt: -1 });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;