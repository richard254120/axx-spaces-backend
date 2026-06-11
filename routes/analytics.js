import express from "express";
import { getDemographics } from "../controllers/analyticsController.js";

const router = express.Router();

router.get("/demographics", getDemographics);

export default router;
