import express from "express";
import { createJob, getMoverJobs } from "../controllers/jobController.js";
import { auth } from "../middleware/auth.js"; // Corrected path and export name

const router = express.Router();

// @route   POST /api/jobs
// Note: If you want customers to be able to post jobs WITHOUT being logged in, 
// remove the 'auth' middleware from this line.
router.post("/", createJob); 

// @route   GET /api/jobs/mover
// Updated to use the correct 'auth' function imported from middleware
router.get("/mover", auth, getMoverJobs);

export default router;