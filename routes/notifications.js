import express from "express";
import { sendBoostReminders, scheduledBoostReminders } from "../controllers/notificationController.js";
import { auth } from "../middleware/auth.js";
import Notification from "../models/Notification.js";

const router = express.Router();

// Get real notifications for the authenticated user
router.get("/my", auth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, notifications });
  } catch (err) {
    console.error("Error fetching user notifications:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Mark a notification as read
router.put("/:id/read", auth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId },
      { status: "confirmed" },
      { new: true }
    );
    res.json({ success: true, notification });
  } catch (err) {
    console.error("Error marking notification read:", err);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

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
