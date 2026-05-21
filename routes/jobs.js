import express from "express";
import Job from "../models/Job.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/", protect, async (req, res) => {
  try {
    const { moverId, moverName, serviceType, pickupLocation, dropoffLocation, scheduledDate, notes, customerPhone, customerName, county } = req.body;
    if (!moverId || !serviceType || !pickupLocation || !dropoffLocation || !scheduledDate || !customerPhone)
      return res.status(400).json({ message: "Please fill in all required fields." });
    const job = await Job.create({ customer: req.user._id, customerName: customerName || req.user.name, customerPhone, mover: moverId, moverName, serviceType, pickupLocation, dropoffLocation, scheduledDate, notes, county, status: "pending" });
    res.status(201).json({ message: "Job request sent successfully.", job });
  } catch (err) { console.error("POST /jobs:", err.message); res.status(500).json({ message: err.message }); }
});

router.get("/mover", protect, async (req, res) => {
  try {
    const jobs = await Job.find({ mover: req.user._id }).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/customer", protect, async (req, res) => {
  try {
    const jobs = await Job.find({ customer: req.user._id }).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch("/:id/accept", protect, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found." });
    if (job.mover.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Not authorised." });
    if (job.status !== "pending") return res.status(400).json({ message: "Job is no longer pending." });
    job.status = "accepted"; job.acceptedAt = new Date();
    await job.save();
    res.json({ message: "Job accepted.", job });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch("/:id/set-price", protect, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: "Enter a valid amount." });
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found." });
    if (job.mover.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Not authorised." });
    job.amount = amount; await job.save();
    res.json({ message: "Price updated.", job });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch("/:id/complete", protect, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found." });
    if (job.mover.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Not authorised." });
    if (!["accepted", "active"].includes(job.status)) return res.status(400).json({ message: "Cannot complete from current status." });
    job.status = "completed"; job.completedAt = new Date();
    await job.save();
    res.json({ message: "Job completed.", job });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch("/:id/cancel", protect, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found." });
    const isMover    = job.mover.toString()    === req.user._id.toString();
    const isCustomer = job.customer.toString() === req.user._id.toString();
    if (!isMover && !isCustomer) return res.status(403).json({ message: "Not authorised." });
    if (job.status === "completed") return res.status(400).json({ message: "Cannot cancel a completed job." });
    job.status = "cancelled"; await job.save();
    res.json({ message: "Job cancelled.", job });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

export default router;