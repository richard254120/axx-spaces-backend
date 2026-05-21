import Job from "../models/Job.js";

// @desc    Create a new moving job request (Public route)
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
      county 
    } = req.body;

    if (!moverId || !customerName || !customerPhone || !serviceType || !pickupLocation || !dropoffLocation || !scheduledDate) {
      return res.status(400).json({ message: "Missing required booking specifications." });
    }
    
    const newJob = new Job({
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
      status: "pending" // Job starts as pending
    });

    await newJob.save();
    res.status(201).json({ message: "Booking logged successfully!", job: newJob });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all jobs assigned to the logged-in mover
// @route   GET /api/jobs/mover
export const getMoverJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ moverId: req.user.id }).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Accept a job request
// @route   PUT /api/jobs/:id/accept
export const acceptJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found" });

    // Security check: Ensure this job belongs to the mover logged in
    if (job.moverId.toString() !== req.user.id) {
      return res.status(401).json({ message: "Unauthorized action on this profile line." });
    }

    job.status = "accepted";
    await job.save();

    res.json({ message: "Job request accepted successfully!", job });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};