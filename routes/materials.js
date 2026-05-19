import express from "express";
import { auth } from "../middleware/auth.js";
import upload from "../config/multer.js";
import {
  createMaterial,
  getApprovedMaterials,
  getMyMaterials,
  approveMaterial,
  rejectMaterial,
  markAsSold,
  deleteMaterial
} from "../controllers/materialController.js";

const router = express.Router();

router.post("/create", auth, upload.array("images", 8), createMaterial);
router.get("/", getApprovedMaterials);
router.get("/seller/my-materials", auth, getMyMaterials);
router.patch("/:id/approve", auth, approveMaterial);
router.patch("/:id/reject", auth, rejectMaterial);
router.patch("/:id/sold", auth, markAsSold);
router.delete("/:id", auth, deleteMaterial);

export default router;