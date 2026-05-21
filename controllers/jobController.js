import Job from "../models/Job.js";
import mongoose from "mongoose";

// @desc    Create a new job booking (no login required)
// @route   POST /api/jobs
export const createJob = async (req, res) => {
  try {
    const {
      moverId,
      moverName,
      customerName,
      customerPhone,
      serviceType,
      pickupLocation,
      dropoffLocation,
      scheduledDate,
      notes,
      county,
    } = req.body;

    // Validate required fields
    if (!moverId || !customerName || !customerPhone || !serviceType ||
        !pickupLocation || !dropoffLocation || !scheduledDate) {
      return res.status(400).json({
        message: "Please provide all required fields: name, phone, service, pickup, dropoff, and date.",
      });
    }

    // Validate moverId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(moverId)) {
      return res.status(400).json({ message: "Invalid mover ID." });
    }

    const job = await Job.create({
      // If a logged-in user submitted, use their ID; otherwise use moverId as a placeholder
      // so the required schema field is satisfied
      customer: req.user?.id || moverId,
      customerName,
      customerPhone,
      mover: moverId,
      moverName: moverName || "",
      serviceType,
      pickupLocation,
      dropoffLocation,
      scheduledDate,
      notes: notes || "",
      county: county || "",
      amount: 0,       // price is agreed offline; can be updated by admin or mover later
      status: "pending",
    });

    res.status(201).json({ message: "Booking request sent successfully.", job });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all jobs assigned to the logged-in mover
// @route   GET /api/jobs/mover
export const getMoverJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ mover: req.user.id }).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mover accepts a pending job (unlocks customer phone on dashboard)
// @route   PUT /api/jobs/:id/accept
export const acceptJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found." });

    if (job.mover.toString() !== req.user.id)
      return res.status(403).json({ message: "You are not assigned to this job." });

    if (job.status !== "pending")
      return res.status(400).json({ message: `Job is already ${job.status}.` });

    job.status = "accepted";
    await job.save();

    res.json({ message: "Job accepted successfully.", job });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mover marks a job as completed
// @route   PATCH /api/jobs/:id/complete
export const completeJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found." });

    if (job.mover.toString() !== req.user.id)
      return res.status(403).json({ message: "You are not assigned to this job." });

    if (!["accepted", "active"].includes(job.status))
      return res.status(400).json({ message: "Only accepted or active jobs can be completed." });

    job.status = "completed";
    await job.save();

    res.json({ message: "Job marked as completed.", job });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};