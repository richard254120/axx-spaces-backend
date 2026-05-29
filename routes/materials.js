import express from "express";
import { auth } from "../middleware/auth.js";
import upload from "../config/multer.js";
import security from "../middleware/security.js";
import { trackMaterialView } from "../middleware/viewTracking.js";
import {
  createMaterial,
  getApprovedMaterials,
  getMyMaterials,
  getMaterialById,
  approveMaterial,
  rejectMaterial,
  markAsSold,
  deleteMaterial
} from "../controllers/materialController.js";

const router = express.Router();

router.post("/create", auth, security.uploadLimiter, upload.array("images", 8), createMaterial);
router.get("/", getApprovedMaterials);
router.get("/:id", trackMaterialView, getMaterialById);
router.get("/seller/my-materials", auth, getMyMaterials);
router.patch("/:id/approve", auth, approveMaterial);
router.patch("/:id/reject", auth, rejectMaterial);
router.patch("/:id/sold", auth, markAsSold);
router.patch("/:id", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "❌ Access denied. Admin only." });
    }
    const Material = (await import("../models/Material.js")).default;
    const material = await Material.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!material) return res.status(404).json({ error: "❌ Material not found" });
    res.json({ success: true, material });
  } catch (error) {
    console.error("❌ Update material error:", error);
    res.status(500).json({ error: error.message });
  }
});
router.delete("/:id", auth, deleteMaterial);

export default router;