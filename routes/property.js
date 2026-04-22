import express from "express";
import Property from "../models/Property.js";
import multer from "multer";
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
   MULTER (TEMP STORAGE)
========================= */
const storage = multer.memoryStorage();
const upload = multer({ storage });

/* =========================
   CREATE PROPERTY (UPLOAD)
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

    let imageUrl = null;

    /* 🔥 UPLOAD TO CLOUDINARY */
    if (req.file) {
      const result = await cloudinary.uploader.upload_stream(
        { folder: "axx-spaces" },
        (error, result) => {
          if (error) throw error;
          return result;
        }
      );

      // FIX: wrap buffer upload
      const stream = cloudinary.uploader.upload_stream(
        { folder: "axx-spaces" },
        async (error, result) => {
          if (error) throw error;

          imageUrl = result.secure_url;

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
            image: imageUrl,
            status: "pending",
          });

          const saved = await newProperty.save();

          res.status(201).json({
            message: "Property submitted ✔",
            data: saved,
          });
        }
      );

      stream.end(req.file.buffer);

    } else {
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
        amenities,
        status: "pending",
      });

      const saved = await newProperty.save();

      res.status(201).json(saved);
    }

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ error: "Upload failed" });
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
    res.status(500).json({ error: "Fetch failed" });
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

export default router;