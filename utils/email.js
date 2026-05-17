import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const resend = new Resend("re_6qT1yhNw_Ey9TNVw6T3HqCbBGjL4YzMBc");

const ADMIN_EMAILS = [
  "ogudarichard254@gmail.com",
  "lucyleemaish@gmail.com",
  "kenfredmugo1@gmail.com",
];

export const sendPropertyEmail = async (property, owner) => {
  const getEmailHtml = (property, owner) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;">🏠 New Property Submitted</h1>
      </div>
      <div style="background: white; padding: 24px;">
        <h2>Property Details</h2>
        <p><strong>Title:</strong> ${property.title}</p>
        <p><strong>County:</strong> ${property.county}</p>
        <p><strong>Price:</strong> KSh ${Number(property.price).toLocaleString()}</p>
        <p><strong>Owner:</strong> ${owner?.name || "N/A"} (${owner?.email})</p>
        <hr>
        <p>Review this property in the <a href="${process.env.FRONTEND_URL}/dashboard">Admin Dashboard</a></p>
      </div>
    </div>
  `;

  for (const email of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: "Axx Spaces <onboarding@resend.dev>",
        to: email,
        subject: `New Property: ${property.title}`,
        html: getEmailHtml(property, owner),
      });
      console.log(`✅ Email sent to: ${email}`);
    } catch (err) {
      console.error(`❌ Email failed to ${email}:`, err.message);
    }
  }
};
