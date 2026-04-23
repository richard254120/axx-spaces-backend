import express from "express";
import Property from "../models/Property.js";
import multer from "multer";
import path from "path";

const router = express.Router();

/* =========================
   MULTER CONFIG
========================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

/* =========================
   CREATE PROPERTY
========================= */
router.post("/properties", upload.single("image"), async (req, res) => {
  try {
    let imageUrl = null;

    if (req.file) {
      imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    }

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
      type: req.body.type,
      bedrooms: req.body.bedrooms,
      bathrooms: req.body.bathrooms,
      description: req.body.description,
      phone: req.body.phone,
      amenities,
      image: imageUrl,
      status: "pending",
    });

    const saved = await newProperty.save();

    res.status(201).json({
      message: "Property submitted ✔",
      data: saved,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET APPROVED (PUBLIC)
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
   GET PENDING (ADMIN)
========================= */
router.get("/properties/pending", async (req, res) => {
  try {
    const properties = await Property.find({ status: "pending" })
      .sort({ createdAt: -1 });

    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   APPROVE PROPERTY
========================= */
router.patch("/properties/:id/approve", async (req, res) => {
  try {
    const property = await Property.findByIdAndUpdate(
      req.params.id,
      { status: "approved" },
      { new: true }
    );

    res.json({
      message: "Approved ✔",
      property,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   DELETE PROPERTY
========================= */
router.delete("/properties/:id", async (req, res) => {
  try {
    await Property.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted ❌" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;