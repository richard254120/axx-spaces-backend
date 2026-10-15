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
    console.log("[Caretaker Invite] Step 1 - body received:", { name, email, phone, propertyIds });

    if (!name || !email || !phone) {
      return res.status(400).json({ error: "Name, email, and phone are required" });
    }

    // Check if ANY user with this email already exists — prevents MongoDB duplicate-key errors
    const existing = await User.findOne({ email });
    console.log("[Caretaker Invite] Step 2 - existing user check:", existing ? existing.role : "none");
    if (existing) {
      if (existing.role === "caretaker") {
        return res.status(400).json({ error: "A caretaker with this email already exists" });
      }
      return res.status(400).json({
        error: "This email is already registered under a different account. Please use a different email for the caretaker.",
      });
    }

    // Verify the properties actually belong to this landlord
    let validProperties = [];
    if (propertyIds && propertyIds.length > 0) {
      console.log("[Caretaker Invite] Step 3 - looking up propertyIds:", propertyIds);
      const props = await Property.find({
        _id: { $in: propertyIds },
        owner: req.user._id,
      });
      validProperties = props.map((p) => p._id);
    }
    console.log("[Caretaker Invite] Step 4 - validProperties:", validProperties.length);

    // Generate a temporary password the caretaker will be told to change
    const tempPassword = crypto.randomBytes(4).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    console.log("[Caretaker Invite] Step 5 - password hashed, calling User.create...");

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
    console.log("[Caretaker Invite] Step 6 - User.create succeeded:", caretaker._id);

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
    console.error("Caretaker invite FULL error:", error.name, error.message);
    console.error("Caretaker invite FULL error detail:", JSON.stringify(error, null, 2));
    // MongoDB duplicate key — email already exists (edge case if check above races)
    if (error.code === 11000) {
      const field = error.keyValue ? Object.keys(error.keyValue)[0] : "field";
      return res.status(400).json({
        error: `This ${field} is already registered. Please use a different ${field} for the caretaker account.`,
      });
    }
    // Mongoose validation errors — surface specific field messages
    if (error.name === "ValidationError") {
      const msg = Object.values(error.errors).map((e) => e.message).join(", ");
      return res.status(400).json({ error: msg });
    }
    // CastError — usually invalid ObjectId in propertyIds
    if (error.name === "CastError") {
      return res.status(400).json({ error: `Invalid value for field: ${error.path}` });
    }
    res.status(500).json({
      error: `Server error while inviting caretaker: ${error.message || "Unknown error"}. Please try again.`,
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
