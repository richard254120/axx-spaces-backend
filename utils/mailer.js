import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE, // "gmail"
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Sends an email notification to the admin when a new property is submitted.
 * @param {Object} property - The saved property object
 * @param {Object} owner - The landlord user object (from req.user)
 */
export const sendNewPropertyNotification = async (property, owner) => {
  try {
    await transporter.sendMail({
      from: `"Axx Spaces" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // notify yourself (admin)
      subject: `🏠 New Property Submitted — ${property.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 24px; border-radius: 10px;">
          <div style="background: #1f2937; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: #fbbf24; margin: 0; font-size: 22px;">🏠 New Property Submitted</h1>
            <p style="color: #94a3b8; margin: 6px 0 0; font-size: 14px;">Axx Spaces Admin Notification</p>
          </div>

          <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
            
            <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 16px;">Property Details</h2>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px 0; color: #6b7280; width: 140px;">Title</td>
                <td style="padding: 10px 0; color: #1f2937; font-weight: bold;">${property.title}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px 0; color: #6b7280;">County</td>
                <td style="padding: 10px 0; color: #1f2937;">${property.county}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px 0; color: #6b7280;">Location</td>
                <td style="padding: 10px 0; color: #1f2937;">${property.location || "N/A"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px 0; color: #6b7280;">Type</td>
                <td style="padding: 10px 0; color: #1f2937;">${property.propertyType || "N/A"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px 0; color: #6b7280;">Price</td>
                <td style="padding: 10px 0; color: #22c55e; font-weight: bold;">KSh ${Number(property.price).toLocaleString()} / month</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px 0; color: #6b7280;">Bedrooms</td>
                <td style="padding: 10px 0; color: #1f2937;">${property.bedrooms || "N/A"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px 0; color: #6b7280;">Bathrooms</td>
                <td style="padding: 10px 0; color: #1f2937;">${property.bathrooms || "N/A"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px 0; color: #6b7280;">Status</td>
                <td style="padding: 10px 0;">
                  <span style="background: #fef3c7; color: #d97706; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: bold;">
                    ⏳ PENDING APPROVAL
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #6b7280;">Submitted At</td>
                <td style="padding: 10px 0; color: #1f2937;">${new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}</td>
              </tr>
            </table>

            <h2 style="color: #1f2937; font-size: 18px; margin: 24px 0 16px;">Landlord Details</h2>

            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px 0; color: #6b7280; width: 140px;">Name</td>
                <td style="padding: 10px 0; color: #1f2937; font-weight: bold;">${owner.name || "N/A"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px 0; color: #6b7280;">Email</td>
                <td style="padding: 10px 0; color: #1f2937;">${owner.email || "N/A"}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #6b7280;">Phone</td>
                <td style="padding: 10px 0; color: #1f2937;">${owner.phone || "N/A"}</td>
              </tr>
            </table>

            <div style="margin-top: 28px; text-align: center;">
              <a 
                href="${process.env.FRONTEND_URL}/admin" 
                style="background: #fbbf24; color: #000; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;"
              >
                ✅ Review &amp; Approve Property
              </a>
            </div>

            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
              This is an automated notification from Axx Spaces.<br/>
              Property ID: ${property._id}
            </p>
          </div>
        </div>
      `,
    });

    console.log(`📧 Admin notified about new property: ${property.title}`);
  } catch (err) {
    // Don't crash the request if email fails — just log it
    console.error("❌ Failed to send email notification:", err.message);
  }
};