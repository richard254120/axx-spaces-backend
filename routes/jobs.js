import express from "express";
import { createJob, getMoverJobs, acceptJob } from "../controllers/jobController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// OPEN ROUTE: Anyone can book without registering or passing a token
router.post("/", createJob);

// PROTECTED ROUTES: Only the logged-in mover can view/interact with their jobs dashboard
router.get("/mover", verifyToken, getMoverJobs);
router.put("/:id/accept", verifyToken, acceptJob);

export default router;