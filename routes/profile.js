import express from "express";
import { auth } from "../middleware/auth.js";
import profileUpload from "../config/multerProfile.js";
import {
  getProfile,
  updateProfile,
  changePassword,
  changeEmail,
} from "../controllers/profileController.js";

const router = express.Router();

router.get("/", auth, getProfile);
router.patch("/", auth, profileUpload.single("avatar"), updateProfile);
router.post("/change-password", auth, changePassword);
router.post("/change-email", auth, changeEmail);

export default router;
