import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export async function sendAxxGoManageEmail({ toEmail, posterName, title, listingId, manageToken }) {
  if (!toEmail) return;

  const frontendUrl =
    process.env.FRONTEND_URL ||
    (process.env.NODE_ENV === "production" ? "https://axxspace.com" : "http://localhost:5173");

  const manageUrl = `${frontendUrl}/axxgo/manage/${manageToken}`;
  const listingUrl = `${frontendUrl}/axxgo/listing/${listingId}`;

  try {
    const isSmtpConfigured =
      process.env.EMAIL_SERVICE &&
      process.env.EMAIL_USER &&
      process.env.EMAIL_PASSWORD;

    if (!isSmtpConfigured) {
      console.log(`[AxxGo] Email not configured. Manage URL for "${title}": ${manageUrl}`);
      return;
    }

    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"AxxGo - AxxSpace" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Your AxxGo Listing is Live! [Manage: ${title}]`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f1729; color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #334155;">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #334155;">
            <h1 style="color: #ef4444; margin: 0; font-size: 24px; font-weight: bold;">AxxGo</h1>
            <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Instant Classifieds by AxxSpace</p>
          </div>

          <div style="padding: 24px 0;">
            <p style="font-size: 16px; margin: 0 0 16px;">Hello <strong>${posterName || "Friend"}</strong>,</p>
            <p style="font-size: 15px; color: #cbd5e1; line-height: 1.5; margin: 0 0 20px;">
              Your listing <strong>"${title}"</strong> has been published and is now <span style="color: #10b981; font-weight: bold;">LIVE</span> for thousands of buyers and searchers!
            </p>

            <div style="background: #1e293b; border: 1px solid #475569; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Secret Management Link</p>
              <p style="margin: 0 0 12px; font-size: 13px; color: #cbd5e1;">Keep this link private. Anyone with this link can edit details, change status to "Sold", "Rented", or "Unavailable", renew or delete the post.</p>
              <a href="${manageUrl}" style="display: inline-block; background: #dc2626; color: white; text-decoration: none; font-weight: bold; padding: 10px 20px; border-radius: 6px; font-size: 14px;">Manage My Listing</a>
              <p style="margin: 12px 0 0; font-size: 12px; color: #64748b; word-break: break-all;">${manageUrl}</p>
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${listingUrl}" style="color: #38bdf8; text-decoration: underline; font-size: 14px;">View Your Live Listing on AxxGo &rarr;</a>
            </div>

            <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px;">
              <p style="margin: 0; font-size: 13px; color: #fca5a5;">
                <strong>Safety Notice:</strong> AxxGo listings automatically expire after 30 days unless renewed. Never ask buyers or tenants for payment before in-person viewing.
              </p>
            </div>
          </div>

          <div style="border-top: 1px solid #334155; padding-top: 16px; text-align: center; font-size: 12px; color: #64748b;">
            &copy; ${new Date().getFullYear()} AxxSpace &bull; Instant Kenya Classifieds
          </div>
        </div>
      `,
    });
    console.log(`[AxxGo] Management email sent to ${toEmail}`);
  } catch (err) {
    console.warn(`[AxxGo] Failed to send email to ${toEmail}:`, err.message);
  }
}

