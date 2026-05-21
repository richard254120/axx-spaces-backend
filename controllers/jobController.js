import Job from "../models/Job.js";

// @desc    Create a new moving job request with detailed logistics specs
// @route   POST /api/jobs
export const createJob = async (req, res) => {
  try {
    const { 
      moverId, 
      moverName, 
      serviceType, 
      pickupLocation, 
      dropoffLocation, 
      scheduledDate, 
      notes, 
      customerPhone, 
      customerName, 
      county 
    } = req.body;

    // Check for mandatory logistics flags
    if (!moverId || !serviceType || !pickupLocation || !dropoffLocation || !scheduledDate || !customerPhone) {
      return res.status(400).json({ message: "Missing required booking details." });
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
      county
    });

    await newJob.save();
    res.status(201).json({ message: "Job request processed and saved to database successfully!", job: newJob });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all jobs assigned specifically to the logged-in mover
// @route   GET /api/jobs/mover
export const getMoverJobs = async (req, res) => {
  try {
    // req.user.id is attached dynamically by your auth verification middleware
    const jobs = await Job.find({ moverId: req.user.id }).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};