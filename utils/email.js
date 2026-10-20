import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

// Initialize Resend only if API key is available
let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ? `AxxSpace <${process.env.RESEND_FROM_EMAIL}>` : "Axxspace <admin@axxspace.com>";

const ADMIN_EMAILS = [
  "admin@axxspace.com",
];

export const sendEmail = async ({ to, subject, html }) => {
  if (!resend) {
    console.log(" [Email Mock] Would send email to:", to, "Subject:", subject);
    return { success: true, mocked: true };
  }
  try {
    const res = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    return res;
  } catch (error) {
    console.error("Error sending email via Resend:", error);
    throw error;
  }
};

export const sendSMS = async ({ to, message }) => {
  console.log(` [SMS Mock] Sent to ${to}: ${message}`);
  return { success: true };
};

export const sendPropertyEmail = async (property, owner) => {
  const getEmailHtml = (property, owner) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;"> New Property Submitted</h1>
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

  console.log(` Attempting to send property email for: ${property.title}`);
  if (!resend) {
    console.log(" [Email Mock] Would send property email to:", ADMIN_EMAILS);
    return;
  }
  for (const email of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `New Property: ${property.title}`,
        html: getEmailHtml(property, owner),
      });
      console.log(` Property email sent to: ${email}`);
    } catch (err) {
      console.error(` Property email failed to ${email}:`, err.message);
      console.error(` Full error:`, err);
    }
  }
};

export const sendMaterialEmail = async (material, seller) => {
  const getEmailHtml = (material, seller) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;"> New Material Uploaded</h1>
      </div>
      <div style="background: white; padding: 24px;">
        <h2>Material Details</h2>
        <p><strong>Title:</strong> ${material.title}</p>
        <p><strong>Category:</strong> ${material.category}</p>
        <p><strong>Price:</strong> KSh ${Number(material.price).toLocaleString()}</p>
        <p><strong>Condition:</strong> ${material.condition}</p>
        <p><strong>Seller:</strong> ${seller?.name || "N/A"} (${seller?.email})</p>
        <hr>
        <p>Review this material in the <a href="${process.env.FRONTEND_URL}/dashboard">Admin Dashboard</a></p>
      </div>
    </div>
  `;

  console.log(` Attempting to send material email for: ${material.title}`);
  if (!resend) {
    console.log(" [Email Mock] Would send material email to:", ADMIN_EMAILS);
    return;
  }
  for (const email of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: "Axxspace <admin@axxspace.com>",
        to: email,
        subject: `New Material: ${material.title}`,
        html: getEmailHtml(material, seller),
      });
      console.log(` Material email sent to: ${email}`);
    } catch (err) {
      console.error(` Material email failed to ${email}:`, err.message);
      console.error(` Full error:`, err);
    }
  }
};

export const sendTourismRegistrationEmail = async (tourismData) => {
  const getEmailHtml = (tourismData) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;"> New Tourism Provider Registration</h1>
      </div>
      <div style="background: white; padding: 24px;">
        <h2>Provider Details</h2>
        <p><strong>Property Name:</strong> ${tourismData.name}</p>
        <p><strong>Category:</strong> ${tourismData.category}</p>
        <p><strong>County:</strong> ${tourismData.county}</p>
        <p><strong>Town:</strong> ${tourismData.town}</p>
        <p><strong>Owner Name:</strong> ${tourismData.ownerName}</p>
        <p><strong>Owner Email:</strong> ${tourismData.ownerEmail}</p>
        <p><strong>Owner Phone:</strong> ${tourismData.ownerPhone}</p>
        <p><strong>Selected Package:</strong> ${tourismData.selectedPackage}</p>
        <hr>
        <p>Review this provider in the <a href="${process.env.FRONTEND_URL}/dashboard">Admin Dashboard</a></p>
      </div>
    </div>
  `;

  console.log(` Attempting to send tourism registration email for: ${tourismData.name}`);
  if (!resend) {
    console.log(" [Email Mock] Would send tourism registration email to:", ADMIN_EMAILS);
    return;
  }
  for (const email of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `New Tourism Provider: ${tourismData.name}`,
        html: getEmailHtml(tourismData),
      });
      console.log(` Tourism registration email sent to: ${email}`);
    } catch (err) {
      console.error(` Tourism registration email failed to ${email}:`, err.message);
      console.error(` Full error:`, err);
    }
  }
};

export const sendMoverRegistrationEmail = async (mover) => {
  const getEmailHtml = (mover) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;"> New Mover Registration</h1>
      </div>
      <div style="background: white; padding: 24px;">
        <h2>Mover Details</h2>
        <p><strong>Name:</strong> ${mover.name}</p>
        <p><strong>Email:</strong> ${mover.email}</p>
        <p><strong>Phone:</strong> ${mover.phone}</p>
        <p><strong>County:</strong> ${mover.county}</p>
        <p><strong>Vehicle Type:</strong> ${mover.vehicleType}</p>
        <p><strong>Services:</strong> ${mover.services?.join(", ") || "N/A"}</p>
        <p><strong>Experience:</strong> ${mover.experienceYears} years</p>
        <hr>
        <p>Review this mover in the <a href="${process.env.FRONTEND_URL}/dashboard">Admin Dashboard</a></p>
      </div>
    </div>
  `;

  console.log(` Attempting to send mover registration email for: ${mover.name}`);
  if (!resend) {
    console.log(" [Email Mock] Would send mover registration email to:", ADMIN_EMAILS);
    return;
  }
  for (const email of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `New Mover: ${mover.name}`,
        html: getEmailHtml(mover),
      });
      console.log(` Mover registration email sent to: ${email}`);
    } catch (err) {
      console.error(` Mover registration email failed to ${email}:`, err.message);
      console.error(` Full error:`, err);
    }
  }
};

export const sendSellerRegistrationEmail = async (seller) => {
  const getEmailHtml = (seller) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;"> New Seller Registration</h1>
      </div>
      <div style="background: white; padding: 24px;">
        <h2>Seller Details</h2>
        <p><strong>Name:</strong> ${seller.name}</p>
        <p><strong>Email:</strong> ${seller.email}</p>
        <p><strong>Phone:</strong> ${seller.phone}</p>
        <p><strong>County:</strong> ${seller.county}</p>
        <p><strong>Town:</strong> ${seller.town}</p>
        <hr>
        <p>Review this seller in the <a href="${process.env.FRONTEND_URL}/dashboard">Admin Dashboard</a></p>
      </div>
    </div>
  `;

  console.log(` Attempting to send seller registration email for: ${seller.name}`);
  if (!resend) {
    console.log(" [Email Mock] Would send seller registration email to:", ADMIN_EMAILS);
    return;
  }
  for (const email of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: "Axxspace <admin@axxspace.com>",
        to: email,
        subject: `New Seller: ${seller.name}`,
        html: getEmailHtml(seller),
      });
      console.log(` Seller registration email sent to: ${email}`);
    } catch (err) {
      console.error(` Seller registration email failed to ${email}:`, err.message);
      console.error(` Full error:`, err);
    }
  }
};

export const sendTourismApprovalEmail = async (email, propertyName) => {
  const getEmailHtml = (propertyName) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;"> Account Approved!</h1>
      </div>
      <div style="background: white; padding: 24px;">
        <h2>Congratulations!</h2>
        <p>Your tourism provider account has been approved.</p>
        <p><strong>Property:</strong> ${propertyName}</p>
        <p>You can now access your dashboard and start managing your property.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${process.env.FRONTEND_URL}/tourism/login" style="background: #fbbf24; color: #1f2937; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Access Your Dashboard
          </a>
        </div>
        <p style="color: #6b7280; font-size: 13px;">If you have any questions, feel free to contact us.</p>
      </div>
    </div>
  `;

  console.log(` Attempting to send tourism approval email to: ${email}`);
  if (!resend) {
    console.log(" [Email Mock] Would send tourism approval email to:", email);
    return;
  }
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Your Tourism Provider Account Has Been Approved",
      html: getEmailHtml(propertyName),
    });
    console.log(` Tourism approval email sent to: ${email}`);
  } catch (err) {
    console.error(` Tourism approval email failed to ${email}:`, err.message);
    console.error(` Full error:`, err);
  }
};

export const sendMoverApprovalEmail = async (email, name) => {
  const getEmailHtml = (name) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;"> Account Approved!</h1>
      </div>
      <div style="background: white; padding: 24px;">
        <h2>Congratulations, ${name}!</h2>
        <p>Your mover account has been approved.</p>
        <p>You can now access your dashboard and start accepting jobs.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${process.env.FRONTEND_URL}/movers/login" style="background: #fbbf24; color: #1f2937; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Access Your Dashboard
          </a>
        </div>
        <p style="color: #6b7280; font-size: 13px;">If you have any questions, feel free to contact us.</p>
      </div>
    </div>
  `;

  console.log(` Attempting to send mover approval email to: ${email}`);
  if (!resend) {
    console.log(" [Email Mock] Would send mover approval email to:", email);
    return;
  }
  try {
    await resend.emails.send({
      from: "Axxspace <admin@axxspace.com>",
      to: email,
      subject: "Your Mover Account Has Been Approved",
      html: getEmailHtml(name),
    });
    console.log(` Mover approval email sent to: ${email}`);
  } catch (err) {
    console.error(` Mover approval email failed to ${email}:`, err.message);
    console.error(` Full error:`, err);
  }
};

export const sendMaterialApprovalEmail = async (email, materialTitle) => {
  const getEmailHtml = (materialTitle) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;"> Material Approved!</h1>
      </div>
      <div style="background: white; padding: 24px;">
        <h2>Great News!</h2>
        <p>Your material has been approved and is now live on the platform.</p>
        <p><strong>Material:</strong> ${materialTitle}</p>
        <p>Buyers can now view and purchase your material.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${process.env.FRONTEND_URL}/seller/dashboard" style="background: #fbbf24; color: #1f2937; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            View Your Dashboard
          </a>
        </div>
        <p style="color: #6b7280; font-size: 13px;">If you have any questions, feel free to contact us.</p>
      </div>
    </div>
  `;

  console.log(` Attempting to send material approval email to: ${email}`);
  if (!resend) {
    console.log(" [Email Mock] Would send material approval email to:", email);
    return;
  }
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Your Material Has Been Approved",
      html: getEmailHtml(materialTitle),
    });
    console.log(` Material approval email sent to: ${email}`);
  } catch (err) {
    console.error(` Material approval email failed to ${email}:`, err.message);
    console.error(` Full error:`, err);
  }
};

export const sendPropertyApprovalEmail = async (email, propertyTitle) => {
  const getEmailHtml = (propertyTitle) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;"> Property Approved!</h1>
      </div>
      <div style="background: white; padding: 24px;">
        <h2>Great News!</h2>
        <p>Your property has been approved and is now live on the platform.</p>
        <p><strong>Property:</strong> ${propertyTitle}</p>
        <p>Tenants can now view and inquire about your property.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #fbbf24; color: #1f2937; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            View Your Dashboard
          </a>
        </div>
        <p style="color: #6b7280; font-size: 13px;">If you have any questions, feel free to contact us.</p>
      </div>
    </div>
  `;

  console.log(` Attempting to send property approval email to: ${email}`);
  if (!resend) {
    console.log(" [Email Mock] Would send property approval email to:", email);
    return;
  }
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Your Property Has Been Approved",
      html: getEmailHtml(propertyTitle),
    });
    console.log(` Property approval email sent to: ${email}`);
  } catch (err) {
    console.error(` Property approval email failed to ${email}:`, err.message);
    console.error(` Full error:`, err);
  }
};

export const sendBusinessRegistrationEmail = async (business, owner) => {
  const getEmailHtml = (business, owner) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;"> New Business Submitted</h1>
      </div>
      <div style="background: white; padding: 24px;">
        <h2>Business Details</h2>
        <p><strong>Business Name:</strong> ${business.name}</p>
        <p><strong>Categories:</strong> ${business.categories?.join(", ") || "N/A"}</p>
        <p><strong>County:</strong> ${business.location?.county || "N/A"}</p>
        <p><strong>Town:</strong> ${business.location?.town || "N/A"}</p>
        <p><strong>Description:</strong> ${business.description?.substring(0, 200) || "N/A"}...</p>
        <p><strong>Owner:</strong> ${owner?.name || business.submitterName || "N/A"} (${owner?.email || "N/A"})</p>
        <p><strong>Owner Phone:</strong> ${owner?.phone || "N/A"}</p>
        <hr>
        <p>Review this business in the <a href="${process.env.FRONTEND_URL}/dashboard">Admin Dashboard</a></p>
      </div>
    </div>
  `;

  console.log(` Attempting to send business registration email for: ${business.name}`);
  if (!resend) {
    console.log(" [Email Mock] Would send business registration email to:", ADMIN_EMAILS);
    return;
  }
  for (const email of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `New Business: ${business.name}`,
        html: getEmailHtml(business, owner),
      });
      console.log(` Business registration email sent to: ${email}`);
    } catch (err) {
      console.error(` Business email failed to ${email}:`, err.message);
      console.error(` Full error:`, err);
    }
  }
};

export const sendLandlordRegistrationEmail = async (landlord) => {
  const getEmailHtml = (landlord) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;"> New Landlord Registration</h1>
      </div>
      <div style="background: white; padding: 24px;">
        <h2>Landlord Details</h2>
        <p><strong>Name:</strong> ${landlord.name}</p>
        <p><strong>Email:</strong> ${landlord.email}</p>
        <p><strong>Phone:</strong> ${landlord.phone}</p>
        <p><strong>Role:</strong> Landlord</p>
        <hr>
        <p>Review this landlord in the <a href="${process.env.FRONTEND_URL}/dashboard">Admin Dashboard</a></p>
      </div>
    </div>
  `;

  console.log(` Attempting to send landlord registration email for: ${landlord.name}`);
  if (!resend) {
    console.log(" [Email Mock] Would send landlord registration email to:", ADMIN_EMAILS);
    return;
  }
  for (const email of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `New Landlord: ${landlord.name}`,
        html: getEmailHtml(landlord),
      });
      console.log(` Landlord registration email sent to: ${email}`);
    } catch (err) {
      console.error(` Landlord email failed to ${email}:`, err.message);
      console.error(` Full error:`, err);
    }
  }
};

export const sendItemRequestEmail = async (itemRequest) => {
  const getEmailHtml = (itemRequest) => {
    const cleanPhone = (itemRequest.phone || "").replace(/[^0-9]/g, "");
    const waPhone = cleanPhone.startsWith("0") ? `254${cleanPhone.slice(1)}` : cleanPhone;
    const budgetStr = (itemRequest.budgetMin || itemRequest.budgetMax)
      ? `${itemRequest.budgetCurrency || "KES"} ${itemRequest.budgetMin ? Number(itemRequest.budgetMin).toLocaleString() : "0"} - ${itemRequest.budgetMax ? Number(itemRequest.budgetMax).toLocaleString() : "Flexible"}${itemRequest.budgetPeriod === "monthly" ? " / month" : ""}`
      : "Open / Flexible";

    const urgencyLabels = {
      immediate: " Immediate (Within 24-48 hrs)",
      this_week: " This Week",
      this_month: " This Month",
      flexible: " Flexible / Planning"
    };

    return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #0c1522; color: #f1f5f9; border-radius: 12px; overflow: hidden; border: 1px solid rgba(201, 168, 76, 0.3);">
      <div style="background: linear-gradient(135deg, #0d1b2a 0%, #1a2942 100%); padding: 28px 24px; text-align: center; border-bottom: 2px solid #c9a84c;">
        <span style="display: inline-block; padding: 4px 12px; background: rgba(201, 168, 76, 0.15); border: 1px solid #c9a84c; border-radius: 20px; font-size: 11px; font-weight: 700; color: #fbbf24; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">AxxSpace Concierge Sourcing</span>
        <h1 style="color: #ffffff; font-size: 22px; margin: 0 0 8px 0; font-weight: 700;">New Custom Request Received</h1>
        <p style="color: #94a3b8; font-size: 13px; margin: 0;">A client has submitted a custom item / service requirement</p>
      </div>

      <div style="padding: 24px; background: #0f1c2e;">
        <!-- Requester Card -->
        <div style="background: #162438; border-radius: 10px; padding: 18px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #fbbf24; font-weight: 700; margin-bottom: 10px;">👤 Requester Information</div>
          <div style="display: grid; grid-template-columns: 1fr; gap: 8px; font-size: 14px;">
            <div><strong style="color: #cbd5e1;">Name:</strong> <span style="color: #ffffff; font-weight: 600;">${itemRequest.name || "Client"}</span></div>
            <div><strong style="color: #cbd5e1;">Email:</strong> <a href="mailto:${itemRequest.email}" style="color: #60a5fa; text-decoration: none;">${itemRequest.email}</a></div>
            <div><strong style="color: #cbd5e1;">Phone:</strong> <span style="color: #ffffff;">${itemRequest.phone || "Not provided"}</span></div>
            <div><strong style="color: #cbd5e1;">Preferred Contact:</strong> <span style="color: #34d399; font-weight: 600; text-transform: uppercase;">${itemRequest.preferredContact || "whatsapp"}</span></div>
          </div>
        </div>

        <!-- Request Details -->
        <div style="background: #162438; border-radius: 10px; padding: 18px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #fbbf24; font-weight: 700; margin-bottom: 10px;">🎯 Requirement Overview</div>
          <div style="display: grid; grid-template-columns: 1fr; gap: 10px; font-size: 14px;">
            <div><strong style="color: #cbd5e1;">Category:</strong> <span style="background: rgba(201, 168, 76, 0.2); color: #fbbf24; padding: 2px 8px; border-radius: 4px; font-weight: 600; text-transform: uppercase; font-size: 12px;">${itemRequest.serviceType || "other"}</span></div>
            <div><strong style="color: #cbd5e1;">Item / Service:</strong> <span style="color: #ffffff; font-size: 16px; font-weight: 700;">"${itemRequest.searchQuery}"</span></div>
            ${itemRequest.targetLocation ? `<div><strong style="color: #cbd5e1;">Location:</strong> <span style="color: #ffffff;">📍 ${itemRequest.targetLocation}</span></div>` : ""}
            ${itemRequest.pickupLocation ? `<div><strong style="color: #cbd5e1;">Pickup:</strong> <span style="color: #ffffff;">📦 ${itemRequest.pickupLocation}</span></div>` : ""}
            ${itemRequest.dropoffLocation ? `<div><strong style="color: #cbd5e1;">Destination:</strong> <span style="color: #ffffff;">🏁 ${itemRequest.dropoffLocation}</span></div>` : ""}
            <div><strong style="color: #cbd5e1;">Budget Range:</strong> <span style="color: #34d399; font-weight: 600;">${budgetStr}</span></div>
            <div><strong style="color: #cbd5e1;">Urgency / Timeline:</strong> <span style="color: #f59e0b;">${urgencyLabels[itemRequest.urgency] || itemRequest.urgency || "Flexible"}</span></div>
            <div style="margin-top: 10px;">
              <strong style="color: #cbd5e1; display: block; margin-bottom: 4px;">Full Specifications & Details:</strong>
              <div style="background: #0d1724; padding: 12px; border-radius: 6px; color: #e2e8f0; font-size: 13px; line-height: 1.5; white-space: pre-wrap; border: 1px solid rgba(255,255,255,0.04);">
                ${itemRequest.details}
              </div>
            </div>
            <div style="font-size: 12px; color: #64748b; margin-top: 6px;">Submitted At: ${new Date(itemRequest.createdAt).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}</div>
          </div>
        </div>

        <!-- Direct Action Buttons -->
        <div style="display: flex; gap: 10px; margin-top: 24px; text-align: center; justify-content: center; flex-wrap: wrap;">
          ${waPhone ? `<a href="https://wa.me/${waPhone}?text=${encodeURIComponent(`Hello ${itemRequest.name || ""}, I am contacting you from AxxSpace regarding your request for: ${itemRequest.searchQuery}`)}" style="background: #25D366; color: #ffffff; font-weight: 700; font-size: 13px; padding: 12px 20px; border-radius: 8px; text-decoration: none; display: inline-block;">💬 Chat on WhatsApp</a>` : ""}
          ${itemRequest.phone ? `<a href="tel:${itemRequest.phone}" style="background: #3b82f6; color: #ffffff; font-weight: 700; font-size: 13px; padding: 12px 20px; border-radius: 8px; text-decoration: none; display: inline-block;">📞 Call Requester</a>` : ""}
          <a href="mailto:${itemRequest.email}?subject=AxxSpace Request: ${encodeURIComponent(itemRequest.searchQuery)}" style="background: #334155; color: #f8fafc; font-weight: 700; font-size: 13px; padding: 12px 20px; border-radius: 8px; text-decoration: none; display: inline-block;">✉️ Send Email</a>
        </div>
      </div>

      <div style="background: #0a111a; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.06);">
        Manage all custom requests in your <a href="${process.env.FRONTEND_URL || "https://axxspace.com"}/admin" style="color: #fbbf24; text-decoration: none;">AxxSpace Admin Dashboard</a>
      </div>
    </div>
  `;
  };

  console.log(` Attempting to send item request email for: ${itemRequest.searchQuery}`);
  if (!resend) {
    console.log(" [Email Mock] Would send item request email to:", ADMIN_EMAILS);
    return;
  }
  for (const email of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `New Item Request: ${itemRequest.searchQuery}`,
        html: getEmailHtml(itemRequest),
      });
      console.log(` Item request email sent to: ${email}`);
    } catch (err) {
      console.error(` Item request email failed to ${email}:`, err.message);
      console.error(` Full error:`, err);
    }
  }
}

export const sendCaretakerInviteEmail = async (email, name, landlordName, tempPassword) => {
  const getEmailHtml = () => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;">You've Been Added as a Caretaker</h1>
        <p style="color: #94a3b8; margin: 6px 0 0;">Axxspace Manager</p>
      </div>
      <div style="background: white; padding: 24px; border: 1px solid #e5e7eb;">
        <p>Hi <strong>${name}</strong>,</p>
        <p><strong>${landlordName}</strong> has added you as a caretaker on Axxspace Manager. You can now log in to manage the properties assigned to you.</p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 6px;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 0;"><strong>Temporary Password:</strong> ${tempPassword}</p>
        </div>
        <p style="color: #b45309; font-size: 13px;">For your security, please change this password after logging in (Settings → Change Password).</p>
        <p style="color: #6b7280; font-size: 13px;">Download the Axxspace Manager app and sign in as "Caretaker" using the credentials above.</p>
      </div>
    </div>
  `;

  console.log(`Attempting to send caretaker invite email to: ${email}`);
  if (!resend) {
    console.log("[Email Mock] Would send caretaker invite email to:", email);
    return;
  }
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `${landlordName} added you as a Caretaker on Axxspace`,
      html: getEmailHtml(),
    });
    console.log(`Caretaker invite email sent to: ${email}`);
  } catch (err) {
    console.error(`Caretaker invite email failed to ${email}:`, err.message);
  }
};

export const sendWelcomeEmail = async (email, name, role) => {
  if (!email) return;
  const roleLabel = ({ landlord: "Landlord", agent: "Agent", host: "Host", caretaker: "Caretaker" })[role] || "member";
  const safeName = String(name || "there").replace(/[<>&"]/g, "");
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;">Welcome to Axxspace</h1>
      </div>
      <div style="background: white; padding: 24px; border: 1px solid #e5e7eb;">
        <p>Hi <strong>${safeName}</strong>,</p>
        <p>Your ${roleLabel} account has been created. You can now sign in to the Axxspace Manager app and start adding your listings.</p>
        <p style="color: #6b7280; font-size: 13px;">If you didn't create this account, please contact us at admin@axxspace.com.</p>
      </div>
    </div>
  `;
  try {
    await sendEmail({ to: email, subject: "Welcome to Axxspace", html });
    console.log(`Welcome email sent to: ${email}`);
  } catch (err) {
    console.error(`Welcome email failed to ${email}:`, err.message);
  }
};
