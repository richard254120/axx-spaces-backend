import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { sendEmail } from "./email.js";

export const notifyUser = async (userId, { type, title, message, data }) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      console.warn(`[notifyUser] User with ID ${userId} not found.`);
      return;
    }

    // 1. Send an email notifying the user
    if (user.email) {
      await sendEmail({
        to: user.email,
        subject: title,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #1f2937;">${title}</h2>
            <p>${message}</p>
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #6b7280; font-size: 12px;">This is an automated notification from AxxSpace.</p>
          </div>
        `
      }).catch(err => console.error(`[notifyUser] Failed to send email to ${user.email}:`, err.message));
    }

    // 2. Create database notification record
    try {
      await Notification.create({
        type: type || "subscription",
        userId: userId,
        userName: user.name,
        userPhone: user.phone,
        userEmail: user.email,
        status: "confirmed",
        plan: title,
        createdAt: new Date(),
      });
    } catch (err) {
      console.error("[notifyUser] Failed to save Notification record:", err.message);
    }

  } catch (error) {
    console.error("[notifyUser] Unexpected error:", error);
  }
};
