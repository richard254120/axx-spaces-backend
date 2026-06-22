import express from "express";
import { getDemographics, getSummary } from "../controllers/analyticsController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.get("/demographics", getDemographics);
router.get("/summary", auth, getSummary);

export default router;
