/**
 * Waitlist Routes  — /api/waitlist
 *
 * Public  : POST   /api/waitlist/:propertyId        — join waitlist (no auth needed)
 * Landlord: GET    /api/waitlist/:propertyId         — list waitlist for a property
 * Landlord/Caretaker: POST /api/waitlist/:id/notify          — send "unit available" notification
 * Landlord: DELETE /api/waitlist/:id                 — remove a person from waitlist
 */

import express from "express";
import { Resend } from "resend";
import { protect } from "../middleware/auth.js";
import Property from "../models/Property.js";
import Waitlist from "../models/Waitlist.js";
import Notification from "../models/Notification.js";

const router = express.Router();

// ── Initialise Resend (graceful – won't crash if key missing)
let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: format a Kenyan phone number for WhatsApp (must start with 254)
// ─────────────────────────────────────────────────────────────────────────────
function formatKenyaPhone(phone) {
  if (!phone) return "";
  let cleaned = phone.toString().replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = cleaned.substring(1);
  if (cleaned.startsWith("254")) return cleaned;
  return "254" + cleaned;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build the official notification email HTML
// ─────────────────────────────────────────────────────────────────────────────
function buildAvailabilityEmail({ recipientName, propertyTitle, propertyLocation, landlordName, landlordPhone, landlordEmail }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Property Now Available — Axxspace</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:32px 40px;text-align:center;">
              <p style="color:#93c5fd;font-size:13px;font-weight:700;letter-spacing:3px;margin:0 0 8px 0;text-transform:uppercase;">Axxspace Rental Platform</p>
              <h1 style="color:#ffffff;font-size:26px;font-weight:700;margin:0;line-height:1.3;">Great News — A Unit Is Now Available!</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px 0;">
                Dear <strong>${recipientName}</strong>,
              </p>
              <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px 0;">
                We are pleased to inform you that a unit in the property you placed on our waitlist is now
                <strong style="color:#059669;">available for rent</strong>. Please find the details below.
              </p>

              <!-- Property card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:24px;margin-bottom:28px;">
                <tr>
                  <td>
                    <p style="font-size:13px;color:#6b7280;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Property</p>
                    <p style="font-size:18px;font-weight:700;color:#111827;margin:0 0 12px 0;">${propertyTitle}</p>
                    <p style="font-size:14px;color:#4b5563;margin:0;">📍 ${propertyLocation}</p>
                  </td>
                </tr>
              </table>

              <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px 0;">
                To confirm your interest or to arrange a viewing, please contact the landlord directly using the information below.
                Please note that units are offered on a <strong>first-come, first-served</strong> basis, so we encourage you to act promptly.
              </p>

              <!-- Landlord contact card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:24px;margin-bottom:32px;">
                <tr>
                  <td>
                    <p style="font-size:13px;color:#6b7280;margin:0 0 12px 0;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Landlord Contact</p>
                    <p style="font-size:15px;color:#1e3a5f;font-weight:600;margin:0 0 6px 0;">👤 ${landlordName}</p>
                    ${landlordPhone ? `<p style="font-size:14px;color:#1e40af;margin:0 0 6px 0;">📞 ${landlordPhone}</p>` : ""}
                    ${landlordEmail ? `<p style="font-size:14px;color:#1e40af;margin:0;">✉️ ${landlordEmail}</p>` : ""}
                  </td>
                </tr>
              </table>

              <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0;">
                This notification was sent to you because you joined the waitlist for the property listed above on
                <strong>Axxspace</strong>. If you are no longer interested, you may disregard this message.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
              <p style="color:#9ca3af;font-size:12px;margin:0 0 4px 0;">© ${new Date().getFullYear()} Axxspace — All rights reserved.</p>
              <p style="color:#9ca3af;font-size:12px;margin:0;">This is an automated notification. Please do not reply to this email.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/waitlist/:propertyId  — PUBLIC: join waitlist
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:propertyId", async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { name, email, phone, message, moveInDate, leaseDuration, occupants } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ error: "Name, email, and phone are required." });
    }

    const property = await Property.findById(propertyId).populate("owner", "name email phone");
    if (!property) return res.status(404).json({ error: "Property not found." });

    // Prevent joining waitlist if units are still available
    if (property.availableUnits > 0) {
      return res.status(400).json({ error: "This property still has available units. You can book it directly." });
    }

    // Create waitlist entry (unique index prevents duplicates)
    const entry = await Waitlist.create({
      property: propertyId,
      landlord: property.owner._id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      message: (message || "").trim(),
      moveInDate: (moveInDate || "").trim(),
      leaseDuration: (leaseDuration || "").trim(),
      occupants: (occupants || "").trim(),
    });

    // Create an in-app notification for the landlord
    const detailSnippet = moveInDate ? ` (Target Move-in: ${moveInDate})` : "";
    await Notification.create({
      type: "waitlist_request",
      userId: property.owner._id,
      userName: name.trim(),
      userPhone: phone.trim(),
      userEmail: email.trim().toLowerCase(),
      propertyId: property._id,
      message: `${name} joined the priority waitlist for "${property.title}"${detailSnippet}.`,
      read: false,
    });

    res.status(201).json({
      success: true,
      message: "You have been added to the waitlist. The landlord will contact you when a unit becomes available.",
      entryId: entry._id,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "You are already on the waitlist for this property." });
    }
    console.error("Waitlist join error:", error.message);
    res.status(500).json({ error: "Could not join waitlist. Please try again." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/waitlist/:propertyId  — LANDLORD: list all waitlist entries (FIFO)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:propertyId", protect, async (req, res) => {
  try {
    const property = await Property.findById(req.params.propertyId);
    if (!property) return res.status(404).json({ error: "Property not found." });

    // Ensure requesting user owns this property
    if (property.owner.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied. You do not own this property." });
    }

    const entries = await Waitlist.find({
      property: req.params.propertyId,
      status: { $in: ["waiting", "notified"] },
    }).sort({ position: 1 }); // ascending = first-come first-served

    res.json({ entries, total: entries.length });
  } catch (error) {
    console.error("Waitlist fetch error:", error.message);
    res.status(500).json({ error: "Could not fetch waitlist." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/waitlist/landlord/all  — LANDLORD or CARETAKER: get waitlist entries
//
// • Landlord  → entries across ALL their properties (landlord === req.user._id)
// • Caretaker → entries for their ASSIGNED properties (via assignedProperties)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/landlord/all", protect, async (req, res) => {
  try {
    let entries;

    if (req.user.role === "caretaker") {
      // Pull the caretaker's User record to get assignedProperties
      const User = (await import("../models/User.js")).default;
      const caretaker = await User.findById(req.user._id).select("assignedProperties");
      const assignedIds = caretaker?.assignedProperties || [];

      entries = await Waitlist.find({
        property: { $in: assignedIds },
        status: { $in: ["waiting", "notified"] },
      })
        .populate("property", "title location county images")
        .sort({ position: 1 });

    } else {
      // Landlord — return their own waitlist entries
      entries = await Waitlist.find({
        landlord: req.user._id,
        status: { $in: ["waiting", "notified"] },
      })
        .populate("property", "title location county images")
        .sort({ position: 1 });
    }

    res.json({ entries, total: entries.length });
  } catch (error) {
    console.error("Waitlist all fetch error:", error.message);
    res.status(500).json({ error: "Could not fetch waitlist." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/waitlist/:id/notify  — LANDLORD: send "unit available" notification
// Sends BOTH email (via Resend) and returns WhatsApp URL for landlord to open
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/notify", protect, async (req, res) => {
  try {
    const entry = await Waitlist.findById(req.params.id).populate(
      "property",
      "title location county owner"
    );

    if (!entry) return res.status(404).json({ error: "Waitlist entry not found." });

    // Property owner, an admin, or a caretaker assigned to this property can send this notification
    const isOwner = entry.property.owner.toString() === req.user._id.toString();
    let isAssignedCaretaker = false;
    if (req.user.role === "caretaker") {
      const User = (await import("../models/User.js")).default;
      const caretaker = await User.findById(req.user._id).select("assignedProperties");
      isAssignedCaretaker = (caretaker?.assignedProperties || []).some(
        (id) => id.toString() === entry.property._id.toString()
      );
    }
    if (!isOwner && !isAssignedCaretaker && req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied." });
    }

    const property = entry.property;
    const landlordName = req.user.name || "Landlord";
    const landlordPhone = req.user.phone || "";
    const landlordEmail = req.user.email || "";

    // ── 1. Send email via Resend ────────────────────────────────────────────
    let emailSent = false;
    let emailError = null;

    if (resend) {
      try {
        const htmlContent = buildAvailabilityEmail({
          recipientName: entry.name,
          propertyTitle: property.title,
          propertyLocation: `${property.location}, ${property.county}`,
          landlordName,
          landlordPhone,
          landlordEmail,
        });

        const fromAddress = process.env.RESEND_FROM_EMAIL || "noreply@axxspace.com";

        const result = await resend.emails.send({
          from: fromAddress,
          to: entry.email,
          subject: `Great News! A Unit at "${property.title}" is Now Available — Axxspace`,
          html: htmlContent,
        });

        if (result.error) {
          emailError = result.error.message;
        } else {
          emailSent = true;
        }
      } catch (err) {
        emailError = err.message;
        console.error("Waitlist email send error:", err.message);
      }
    } else {
      emailError = "Email service not configured (RESEND_API_KEY missing).";
    }

    // ── 2. Build WhatsApp message URL ────────────────────────────────────────
    const waPhone = formatKenyaPhone(entry.phone);
    const waMessage =
      `Dear ${entry.name},\n\n` +
      `I am pleased to inform you that a unit at *${property.title}* (${property.location}, ${property.county}) is now available for rent.\n\n` +
      `You had previously expressed interest in this property and were placed on our waitlist. We would love to have you as our tenant.\n\n` +
      `Please feel free to contact me at your earliest convenience to arrange a viewing or to confirm your interest.\n\n` +
      `Kindly note that units are offered on a first-come, first-served basis.\n\n` +
      `Warm regards,\n${landlordName}\nAxxspace Landlord`;

    const whatsappUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}`;

    // ── 3. Update entry status ───────────────────────────────────────────────
    entry.status = "notified";
    entry.notifiedAt = new Date();
    await entry.save();

    res.json({
      success: true,
      emailSent,
      emailError,
      whatsappUrl,
      message: emailSent
        ? "Email sent successfully. You can also send a WhatsApp message using the link provided."
        : `Email could not be sent (${emailError}). Please use WhatsApp to notify the person.`,
    });
  } catch (error) {
    console.error("Waitlist notify error:", error.message);
    res.status(500).json({ error: "Could not send notification. Please try again." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/waitlist/:id  — LANDLORD: remove a person from waitlist
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id", protect, async (req, res) => {
  try {
    const entry = await Waitlist.findById(req.params.id).populate("property", "owner");
    if (!entry) return res.status(404).json({ error: "Waitlist entry not found." });

    if (
      entry.property.owner.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ error: "Access denied." });
    }

    entry.status = "removed";
    await entry.save();

    res.json({ success: true, message: "Person removed from waitlist." });
  } catch (error) {
    console.error("Waitlist delete error:", error.message);
    res.status(500).json({ error: "Could not remove from waitlist." });
  }
});

export default router;
