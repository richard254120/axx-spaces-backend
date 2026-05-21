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
      county,
      amount // Included layout calculation parameter
    } = req.body;

    if (!customerName || !customerPhone || !serviceType || !pickupLocation || !dropoffLocation || !scheduledDate) {
      return res.status(400).json({ message: "Missing required booking specifications." });
    }
    
    const newJob = new Job({
      moverId: moverId || null, // Can be null if it's a general pool post
      moverName: moverName || "Unassigned",
      customerName,
      customerPhone,
      serviceType,
      pickupLocation,
      dropoffLocation,
      scheduledDate,
      notes,
      county,
      amount: amount || 0, // Fallback if pricing calculation isn't processed yet
      status: "pending" 
    });

    await newJob.save();
    res.status(201).json({ message: "Booking logged successfully!", job: newJob });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all jobs assigned to the logged-in mover OR open marketplace requests
// @route   GET /api/jobs/mover
export const getMoverJobs = async (req, res) => {
  try {
    // Crucial Update: Fetches jobs explicitly assigned to this mover OR system pool pending requests
    const jobs = await Job.find({
      $or: [
        { moverId: req.user.id },
        { status: "pending" }
      ]
    }).sort({ createdAt: -1 });
    
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
    if (job.status !== "pending") return res.status(400).json({ message: "Job has already been claimed." });

    // Assign the logged-in mover as the official handler
    job.moverId = req.user.id;
    job.status = "accepted";
    await job.save();

    res.json({ message: "Job request accepted successfully!", job });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Complete an active job assignment
// @route   PATCH /api/jobs/:id/complete
export const completeJob = async (req, res) => {
  try {
    // Security check: Find the job and ensure it explicitly belongs to the active mover
    const job = await Job.findOne({ _id: req.params.id, moverId: req.user.id });
    if (!job) return res.status(404).json({ message: "Active job layout assignment not found." });

    job.status = "completed";
    await job.save();

    res.json({ message: "Job marked as completed successfully!", job });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};