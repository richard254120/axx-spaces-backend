import express from "express";
import { createJob, getMoverJobs, acceptJob, completeJob } from "../controllers/jobController.js";
import { auth } from "../middleware/auth.js"; // Corrected from authMiddleware.js to auth.js

const router = express.Router();

// 🟢 PUBLIC: Anyone can post a job without being logged in
router.post("/", createJob); 

// 🔴 PROTECTED: Only authenticated movers can view/accept/complete jobs
router.get("/mover", auth, getMoverJobs); // Updated middleware reference
router.put("/:id/accept", auth, acceptJob); // Updated middleware reference
router.patch("/:id/complete", auth, completeJob); // Added to match dashboard execution

export default router;