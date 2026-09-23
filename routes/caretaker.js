import express from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import Property from "../models/Property.js";
import { protect, authorize } from "../middleware/auth.js";
import { sendCaretakerInviteEmail } from "../utils/email.js";

const router = express.Router();

// ====================== LANDLORD: Invite a caretaker ======================
router.post("/invite", protect, authorize("landlord"), async (req, res) => {
  try {
    const { name, email, phone, propertyIds } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ error: "Name, email, and phone are required" });
    }

    const existing = await User.findOne({ email, role: "caretaker" });
    if (existing) {
      return res.status(400).json({ error: "A caretaker with this email already exists" });
    }

    // Verify the properties actually belong to this landlord
    let validProperties = [];
    if (propertyIds && propertyIds.length > 0) {
      const props = await Property.find({
        _id: { $in: propertyIds },
        owner: req.user._id,
      });
      validProperties = props.map((p) => p._id);
    }

    // Generate a temporary password the caretaker will be told to change
    const tempPassword = crypto.randomBytes(4).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const caretaker = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: "caretaker",
      managedBy: req.user._id,
      assignedProperties: validProperties,
      caretakerInviteStatus: "pending",
    });

    sendCaretakerInviteEmail(email, name, req.user.name, tempPassword).catch((err) =>
      console.error("Failed to send caretaker invite email:", err.message)
    );

    res.status(201).json({
      message: "Caretaker invited successfully",
      caretaker: {
        id: caretaker._id,
        name: caretaker.name,
        email: caretaker.email,
        assignedProperties: caretaker.assignedProperties,
      },
      tempPassword, // returned once so landlord can share it manually for now
    });
  } catch (error) {
    console.error("Caretaker invite FULL error:", JSON.stringify(error, null, 2));
    res.status(500).json({ error: "Server error while inviting caretaker" });
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
    if (propertyIds && propertyIds.length > 0) {
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

// (Insert before export default - handled below via patch script)
