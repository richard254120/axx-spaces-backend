import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ? `AxxSpace <${process.env.RESEND_FROM_EMAIL}>` : "Axxspace <admin@axxspace.com>";

const ADMIN_EMAILS = [
  "admin@axxspace.com",
];

export const sendEmail = async ({ to, subject, html }) => {
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
  console.log(`📱 [SMS Mock] Sent to ${to}: ${message}`);
  return { success: true };
};

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

  console.log(`📧 Attempting to send property email for: ${property.title}`);
  for (const email of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `New Property: ${property.title}`,
        html: getEmailHtml(property, owner),
      });
      console.log(`✅ Property email sent to: ${email}`);
    } catch (err) {
      console.error(`❌ Property email failed to ${email}:`, err.message);
      console.error(`❌ Full error:`, err);
    }
  }
};

export const sendMaterialEmail = async (material, seller) => {
  const getEmailHtml = (material, seller) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;">📦 New Material Uploaded</h1>
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

  console.log(`📧 Attempting to send material email for: ${material.title}`);
  for (const email of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: "Axxspace <admin@axxspace.com>",
        to: email,
        subject: `New Material: ${material.title}`,
        html: getEmailHtml(material, seller),
      });
      console.log(`✅ Material email sent to: ${email}`);
    } catch (err) {
      console.error(`❌ Material email failed to ${email}:`, err.message);
      console.error(`❌ Full error:`, err);
    }
  }
};

export const sendTourismRegistrationEmail = async (tourismData) => {
  const getEmailHtml = (tourismData) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;">🏨 New Tourism Provider Registration</h1>
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

  console.log(`📧 Attempting to send tourism registration email for: ${tourismData.name}`);
  for (const email of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `New Tourism Provider: ${tourismData.name}`,
        html: getEmailHtml(tourismData),
      });
      console.log(`✅ Tourism registration email sent to: ${email}`);
    } catch (err) {
      console.error(`❌ Tourism registration email failed to ${email}:`, err.message);
      console.error(`❌ Full error:`, err);
    }
  }
};

export const sendMoverRegistrationEmail = async (mover) => {
  const getEmailHtml = (mover) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;">🚚 New Mover Registration</h1>
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

  console.log(`📧 Attempting to send mover registration email for: ${mover.name}`);
  for (const email of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `New Mover: ${mover.name}`,
        html: getEmailHtml(mover),
      });
      console.log(`✅ Mover registration email sent to: ${email}`);
    } catch (err) {
      console.error(`❌ Mover registration email failed to ${email}:`, err.message);
      console.error(`❌ Full error:`, err);
    }
  }
};

export const sendSellerRegistrationEmail = async (seller) => {
  const getEmailHtml = (seller) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;">🛒 New Seller Registration</h1>
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

  console.log(`📧 Attempting to send seller registration email for: ${seller.name}`);
  for (const email of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: "Axxspace <admin@axxspace.com>",
        to: email,
        subject: `New Seller: ${seller.name}`,
        html: getEmailHtml(seller),
      });
      console.log(`✅ Seller registration email sent to: ${email}`);
    } catch (err) {
      console.error(`❌ Seller registration email failed to ${email}:`, err.message);
      console.error(`❌ Full error:`, err);
    }
  }
};

export const sendTourismApprovalEmail = async (email, propertyName) => {
  const getEmailHtml = (propertyName) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;">🎉 Account Approved!</h1>
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

  console.log(`📧 Attempting to send tourism approval email to: ${email}`);
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Your Tourism Provider Account Has Been Approved",
      html: getEmailHtml(propertyName),
    });
    console.log(`✅ Tourism approval email sent to: ${email}`);
  } catch (err) {
    console.error(`❌ Tourism approval email failed to ${email}:`, err.message);
    console.error(`❌ Full error:`, err);
  }
};

export const sendMoverApprovalEmail = async (email, name) => {
  const getEmailHtml = (name) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;">🎉 Account Approved!</h1>
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

  console.log(`📧 Attempting to send mover approval email to: ${email}`);
  try {
    await resend.emails.send({
      from: "Axxspace <admin@axxspace.com>",
      to: email,
      subject: "Your Mover Account Has Been Approved",
      html: getEmailHtml(name),
    });
    console.log(`✅ Mover approval email sent to: ${email}`);
  } catch (err) {
    console.error(`❌ Mover approval email failed to ${email}:`, err.message);
    console.error(`❌ Full error:`, err);
  }
};

export const sendMaterialApprovalEmail = async (email, materialTitle) => {
  const getEmailHtml = (materialTitle) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;">✅ Material Approved!</h1>
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

  console.log(`📧 Attempting to send material approval email to: ${email}`);
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Your Material Has Been Approved",
      html: getEmailHtml(materialTitle),
    });
    console.log(`✅ Material approval email sent to: ${email}`);
  } catch (err) {
    console.error(`❌ Material approval email failed to ${email}:`, err.message);
    console.error(`❌ Full error:`, err);
  }
};

export const sendPropertyApprovalEmail = async (email, propertyTitle) => {
  const getEmailHtml = (propertyTitle) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;">✅ Property Approved!</h1>
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

  console.log(`📧 Attempting to send property approval email to: ${email}`);
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Your Property Has Been Approved",
      html: getEmailHtml(propertyTitle),
    });
    console.log(`✅ Property approval email sent to: ${email}`);
  } catch (err) {
    console.error(`❌ Property approval email failed to ${email}:`, err.message);
    console.error(`❌ Full error:`, err);
  }
};

export const sendBusinessRegistrationEmail = async (business, owner) => {
  const getEmailHtml = (business, owner) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;">🏢 New Business Submitted</h1>
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

  console.log(`📧 Attempting to send business registration email for: ${business.name}`);
  for (const email of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `New Business: ${business.name}`,
        html: getEmailHtml(business, owner),
      });
      console.log(`✅ Business registration email sent to: ${email}`);
    } catch (err) {
      console.error(`❌ Business email failed to ${email}:`, err.message);
      console.error(`❌ Full error:`, err);
    }
  }
};

export const sendLandlordRegistrationEmail = async (landlord) => {
  const getEmailHtml = (landlord) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;">🏠 New Landlord Registration</h1>
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

  console.log(`📧 Attempting to send landlord registration email for: ${landlord.name}`);
  for (const email of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `New Landlord: ${landlord.name}`,
        html: getEmailHtml(landlord),
      });
      console.log(`✅ Landlord registration email sent to: ${email}`);
    } catch (err) {
      console.error(`❌ Landlord email failed to ${email}:`, err.message);
      console.error(`❌ Full error:`, err);
    }
  }
};

export const sendItemRequestEmail = async (itemRequest) => {
  const getEmailHtml = (itemRequest) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0;">🔍 New Custom Item Request</h1>
      </div>
      <div style="background: white; padding: 24px;">
        <h2>Request Details</h2>
        <p><strong>Name:</strong> ${itemRequest.name || "N/A"}</p>
        <p><strong>Email:</strong> ${itemRequest.email}</p>
        <p><strong>Phone:</strong> ${itemRequest.phone || "N/A"}</p>
        <p><strong>Service Type:</strong> ${itemRequest.serviceType || "other"}</p>
        <p><strong>Search Query:</strong> ${itemRequest.searchQuery}</p>
        <p><strong>Details:</strong> ${itemRequest.details}</p>
        <p><strong>Submitted At:</strong> ${new Date(itemRequest.createdAt).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}</p>
        <hr>
        <p>Review this request in the <a href="${process.env.FRONTEND_URL}/dashboard">Admin Dashboard</a></p>
      </div>
    </div>
  `;

  console.log(`📧 Attempting to send item request email for: ${itemRequest.searchQuery}`);
  for (const email of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `New Item Request: ${itemRequest.searchQuery}`,
        html: getEmailHtml(itemRequest),
      });
      console.log(`✅ Item request email sent to: ${email}`);
    } catch (err) {
      console.error(`❌ Item request email failed to ${email}:`, err.message);
      console.error(`❌ Full error:`, err);
    }
  }
};
