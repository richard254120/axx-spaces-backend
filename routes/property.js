import express from "express";
import Property from "../models/Property.js";
import multer from "multer";

const router = express.Router();

/* =========================
   MULTER CONFIG (IMAGE UPLOAD)
========================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
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

      // GEO
      lat: req.body.lat || null,
      lng: req.body.lng || null,

      // AMENITIES
      amenities,

      // IMAGE
      image: req.file ? req.file.filename : "",

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
    console.error(err);
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
    console.error(err);
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
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET APPROVED (FILTERS + SAFE)
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

    console.log("🔍 FILTER:", filter);

    const properties = await Property.find(filter)
      .sort({ createdAt: -1 });

    res.json(properties);

  } catch (err) {
    console.error("🔥 FETCH ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;