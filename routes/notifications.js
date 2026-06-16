import express from "express";
import { sendBoostReminders, scheduledBoostReminders } from "../controllers/notificationController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// Send boost reminder notifications (admin only)
router.post("/boost-reminders/:type", auth, async (req, res) => {
  // Check if user is admin
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  
  await sendBoostReminders(req, res);
});

// Scheduled boost reminders (for cron job)
router.get("/scheduled-boost-reminders", async (req, res) => {
  const result = await scheduledBoostReminders();
  res.json(result);
});

export default router;
