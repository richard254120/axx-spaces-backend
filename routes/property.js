import express from "express";
import Property from "../models/Property.js";
import multer from "multer";
import fs from "fs";

const router = express.Router();

/* =========================
   ENSURE UPLOADS FOLDER EXISTS
========================= */
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

/* =========================
   MULTER STORAGE (SAFE)
========================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

/* =========================
   FILE FILTER (ONLY IMAGES)
========================= */
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files allowed"), false);
  }
};

/* =========================
   MULTER CONFIG
========================= */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

/* =========================
   CREATE PROPERTY
========================= */
router.post("/properties", (req, res) => {
  upload.single("image")(req, res, async (err) => {
    try {
      // 🔴 HANDLE MULTER ERRORS FIRST
      if (err) {
        console.log("MULTER ERROR:", err.message);
        return res.status(400).json({ error: err.message });
      }

      console.log("BODY:", req.body);
      console.log("FILE:", req.file);

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
        image: req.file ? `/uploads/${req.file.filename}` : null,
        status: "pending",
      });

      const saved = await newProperty.save();

      res.status(201).json({
        message: "Property submitted ✔",
        data: saved,
      });

    } catch (err) {
      console.log("UPLOAD ERROR:", err);
      res.status(500).json({ error: err.message });
    }
  });
});

/* =========================
   GET APPROVED PROPERTIES
========================= */
router.get("/properties/approved", async (req, res) => {
  try {
    const properties = await Property.find({ status: "approved" })
      .sort({ createdAt: -1 });

    res.json(properties);
  } catch (err) {
    console.log("FETCH ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;