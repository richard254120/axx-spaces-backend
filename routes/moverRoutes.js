// routes/jobRoutes.js
import express from "express";
import { auth } from "../middleware/auth.js";
import Job from "../models/Job.js";

const router = express.Router();

// Get jobs assigned to or available for the logged-in mover
router.get("/mover", auth, async (req, res) => {
  try {
    // Finds jobs explicitly assigned to this mover OR pending jobs matching their operational county
    const jobs = await Job.find({
      $or: [
        { mover: req.userId },
        { status: "pending" } // Movers can see all pending system loads to accept them
      ]
    }).sort({ createdAt: -1 });
    
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: "Server error fetching jobs." });
  }
});

// PATCH: Accept a pending job booking
router.patch("/:id/accept", auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: "Job booking not found." });
    if (job.status !== "pending") return res.status(400).json({ error: "Job is already taken or processed." });

    job.mover = req.userId;
    job.status = "accepted";
    await job.save();

    res.json({ message: "Job accepted successfully!", job });
  } catch (error) {
    res.status(500).json({ error: "Failed to accept job." });
  }
});

// PATCH: Complete an active job
router.patch("/:id/complete", auth, async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, mover: req.userId });
    if (!job) return res.status(404).json({ error: "Active job assignment not found." });

    job.status = "completed";
    await job.save();

    res.json({ message: "Job marked as completed!", job });
  } catch (error) {
    res.status(500).json({ error: "Failed to complete job." });
  }
});

export default router;