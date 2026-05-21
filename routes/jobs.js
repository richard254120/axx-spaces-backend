import express from "express";
import { createJob, getMoverJobs } from "../controllers/jobController.js";
import { verifyToken } from "../middleware/authMiddleware.js"; // Replace with your actual auth middleware path

const router = express.Router();

// @route   POST /api/jobs -> Triggered when a customer submits the booking modal
router.post("/", verifyToken, createJob);

// @route   GET /api/jobs/mover -> Triggered on the mover dashboard to fetch their jobs
router.get("/mover", verifyToken, getMoverJobs);

export default router;