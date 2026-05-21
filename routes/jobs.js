import express from "express";
import {
  createJob,
  getMoverJobs,
  acceptJob,
  completeJob,
} from "../controllers/jobController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// POST /api/jobs — customer submits a booking (auth optional; works logged-in or as guest)
router.post("/", createJob);

// GET /api/jobs/mover — mover fetches their job list
router.get("/mover", auth, getMoverJobs);

// PUT /api/jobs/:id/accept — mover accepts a pending job
router.put("/:id/accept", auth, acceptJob);

// PATCH /api/jobs/:id/complete — mover closes a job
router.patch("/:id/complete", auth, completeJob);

export default router;