import express from "express";
import { createJob, getMoverJobs, acceptJob, completeJob } from "../controllers/jobController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.post("/",                   createJob);        // ← no auth, public booking
router.get("/mover",          auth, getMoverJobs);
router.put("/:id/accept",     auth, acceptJob);
router.patch("/:id/complete", auth, completeJob);

export default router;