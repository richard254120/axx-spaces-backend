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
        from: "Axxspace <onboarding@resend.dev>",
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

  for (const email of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: "Axxspace <onboarding@resend.dev>",
        to: email,
        subject: `New Material: ${material.title}`,
        html: getEmailHtml(material, seller),
      });
      console.log(`✅ Email sent to: ${email}`);
    } catch (err) {
      console.error(`❌ Email failed to ${email}:`, err.message);
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

  for (const email of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: "Axxspace <onboarding@resend.dev>",
        to: email,
        subject: `New Tourism Provider: ${tourismData.name}`,
        html: getEmailHtml(tourismData),
      });
      console.log(`✅ Email sent to: ${email}`);
    } catch (err) {
      console.error(`❌ Email failed to ${email}:`, err.message);
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

  for (const email of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: "Axxspace <onboarding@resend.dev>",
        to: email,
        subject: `New Mover: ${mover.name}`,
        html: getEmailHtml(mover),
      });
      console.log(`✅ Email sent to: ${email}`);
    } catch (err) {
      console.error(`❌ Email failed to ${email}:`, err.message);
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

  for (const email of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: "Axxspace <onboarding@resend.dev>",
        to: email,
        subject: `New Seller: ${seller.name}`,
        html: getEmailHtml(seller),
      });
      console.log(`✅ Email sent to: ${email}`);
    } catch (err) {
      console.error(`❌ Email failed to ${email}:`, err.message);
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

  try {
    await resend.emails.send({
      from: "Axxspace <onboarding@resend.dev>",
      to: email,
      subject: "Your Tourism Provider Account Has Been Approved",
      html: getEmailHtml(propertyName),
    });
    console.log(`✅ Approval email sent to: ${email}`);
  } catch (err) {
    console.error(`❌ Email failed to ${email}:`, err.message);
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

  try {
    await resend.emails.send({
      from: "Axxspace <onboarding@resend.dev>",
      to: email,
      subject: "Your Mover Account Has Been Approved",
      html: getEmailHtml(name),
    });
    console.log(`✅ Approval email sent to: ${email}`);
  } catch (err) {
    console.error(`❌ Email failed to ${email}:`, err.message);
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

  try {
    await resend.emails.send({
      from: "Axxspace <onboarding@resend.dev>",
      to: email,
      subject: "Your Material Has Been Approved",
      html: getEmailHtml(materialTitle),
    });
    console.log(`✅ Approval email sent to: ${email}`);
  } catch (err) {
    console.error(`❌ Email failed to ${email}:`, err.message);
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

  try {
    await resend.emails.send({
      from: "Axxspace <onboarding@resend.dev>",
      to: email,
      subject: "Your Property Has Been Approved",
      html: getEmailHtml(propertyTitle),
    });
    console.log(`✅ Approval email sent to: ${email}`);
  } catch (err) {
    console.error(`❌ Email failed to ${email}:`, err.message);
  }
};
