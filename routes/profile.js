import express from "express";
import { auth } from "../middleware/auth.js";
import profileUpload from "../config/multerProfile.js";
import { getProfile, updateProfile } from "../controllers/profileController.js";

const router = express.Router();

router.get("/", auth, getProfile);
router.patch("/", auth, profileUpload.single("avatar"), updateProfile);

export default router;
