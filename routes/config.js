import express from "express";
import { auth } from "../middleware/auth.js";
import Config from "../models/Config.js";

const router = express.Router();

// Get all configurations (admin only)
router.get("/", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    const configs = await Config.getAllConfigs();
    res.json(configs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a specific configuration (admin only)
router.get("/:key", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    const value = await Config.getConfig(req.params.key);
    res.json({ key: req.params.key, value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Set a configuration (admin only)
router.post("/", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    const { key, value, description } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ error: "Key and value are required" });
    }
    const config = await Config.setConfig(key, value, description);
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a configuration (admin only)
router.delete("/:key", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    await Config.deleteOne({ key: req.params.key });
    res.json({ success: true, message: "Configuration deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
