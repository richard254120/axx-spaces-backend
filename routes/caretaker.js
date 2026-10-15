import express from "express";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import Property from "../models/Property.js";
import { protect, authorize } from "../middleware/auth.js";
import { sendCaretakerInviteEmail } from "../utils/email.js";

const router = express.Router();

// ====================== LANDLORD: Invite a caretaker ======================
router.post("/invite", protect, authorize("landlord"), async (req, res) => {
  try {
    const { name, email, phone, password, propertyIds, notes } = req.body;

    // ── Validate required fields ──
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: "Name, email, phone, and password are required." });
    }

    // ── Validate password strength ──
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ error: "Password must contain both letters and numbers." });
    }

    // ── Validate phone format (basic) ──
    if (!/^\+?[\d\s\-]{7,15}$/.test(phone)) {
      return res.status(400).json({ error: "Please enter a valid phone number." });
    }

    // ── Check email not already registered ──
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      if (existing.role === "caretaker") {
        return res.status(400).json({ error: "A caretaker with this email already exists." });
      }
      return res.status(400).json({
        error: "This email is already registered under a different account. Please use a different email.",
      });
    }

    // ── Verify assigned properties belong to this landlord ──
    let validProperties = [];
    if (Array.isArray(propertyIds) && propertyIds.length > 0) {
      const props = await Property.find({
        _id: { $in: propertyIds },
        owner: req.user._id,
      });
      validProperties = props.map((p) => p._id);
    }

    // ── Hash the landlord-provided password ──
    const hashedPassword = await bcrypt.hash(password, 10);

    // ── Step A: insert core fields (passes MongoDB Atlas collection validator) ──
    const caretaker = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password: hashedPassword,
      role: "caretaker",
      isEmailVerified: true,
      landlordType: "general",
      isApproved: true,   // caretakers are pre-approved by the landlord
      status: "approved",
    });

    // ── Step B: patch caretaker-specific fields ──
    await User.findByIdAndUpdate(caretaker._id, {
      managedBy: req.user._id,
      assignedProperties: validProperties,
      caretakerInviteStatus: "pending",
      ...(notes ? { description: notes.trim() } : {}),
    });

    // ── Send welcome email to caretaker (fire-and-forget) ──
    sendCaretakerInviteEmail(
      caretaker.email,
      caretaker.name,
      req.user.name,
      password   // plain password — landlord set it intentionally
    ).catch((err) => console.error("Failed to send caretaker invite email:", err.message));

    res.status(201).json({
      message: "Caretaker added successfully",
      caretaker: {
        id: caretaker._id,
        name: caretaker.name,
        email: caretaker.email,
        phone: caretaker.phone,
        assignedProperties: validProperties,
      },
    });
  } catch (error) {
    console.error("Caretaker invite error:", error.name, error.message);
    if (error.code === 11000) {
      const field = error.keyValue ? Object.keys(error.keyValue)[0] : "field";
      return res.status(400).json({
        error: `This ${field} is already registered. Please use a different ${field}.`,
      });
    }
    if (error.name === "ValidationError") {
      const msg = Object.values(error.errors).map((e) => e.message).join(", ");
      return res.status(400).json({ error: msg });
    }
    if (error.name === "CastError") {
      return res.status(400).json({ error: `Invalid value for field: ${error.path}` });
    }
    res.status(500).json({
      error: `Server error while adding caretaker: ${error.message || "Unknown error"}. Please try again.`,
    });
  }
});

// ====================== LANDLORD: List my caretakers ======================
router.get("/my-caretakers", protect, authorize("landlord"), async (req, res) => {
  try {
    const caretakers = await User.find({ managedBy: req.user._id, role: "caretaker" })
      .select("-password")
      .populate("assignedProperties", "title location");
    res.json({ caretakers });
  } catch (error) {
    console.error("List caretakers error:", error.message);
    res.status(500).json({ error: "Server error while fetching caretakers" });
  }
});

// ====================== CARETAKER: Get my assigned properties ======================
router.get("/my-properties", protect, authorize("caretaker"), async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("assignedProperties");
    res.json({ properties: user.assignedProperties });
  } catch (error) {
    console.error("Caretaker properties error:", error.message);
    res.status(500).json({ error: "Server error while fetching properties" });
  }
});

// ====================== LANDLORD: Update caretaker's assigned properties ======================
router.patch("/:id/properties", protect, authorize("landlord"), async (req, res) => {
  try {
    const { propertyIds } = req.body;

    const caretaker = await User.findOne({
      _id: req.params.id,
      managedBy: req.user._id,
      role: "caretaker",
    });

    if (!caretaker) {
      return res.status(404).json({ error: "Caretaker not found" });
    }

    let validProperties = [];
    if (Array.isArray(propertyIds) && propertyIds.length > 0) {
      const props = await Property.find({
        _id: { $in: propertyIds },
        owner: req.user._id,
      });
      validProperties = props.map((p) => p._id);
    }

    caretaker.assignedProperties = validProperties;
    await caretaker.save();

    const updated = await User.findById(caretaker._id)
      .select("-password")
      .populate("assignedProperties", "title location");

    res.json({ message: "Caretaker's properties updated", caretaker: updated });
  } catch (error) {
    console.error("Update caretaker properties error:", error.message);
    res.status(500).json({ error: "Server error while updating caretaker" });
  }
});

// ====================== LANDLORD: Remove a caretaker ======================
router.delete("/:id", protect, authorize("landlord"), async (req, res) => {
  try {
    const caretaker = await User.findOneAndDelete({
      _id: req.params.id,
      managedBy: req.user._id,
      role: "caretaker",
    });

    if (!caretaker) {
      return res.status(404).json({ error: "Caretaker not found" });
    }

    res.json({ message: "Caretaker removed successfully" });
  } catch (error) {
    console.error("Remove caretaker error:", error.message);
    res.status(500).json({ error: "Server error while removing caretaker" });
  }
});

export default router;
