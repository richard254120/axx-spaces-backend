import User from "../models/User.js";
import Property from "../models/Property.js";
import Material from "../models/Material.js";
import TourismListing from "../models/TourismListing.js";
import { sendEmail, sendSMS } from "../utils/email.js";

// ====================== SEND BOOST REMINDER NOTIFICATIONS ======================
export const sendBoostReminders = async (req, res) => {
  try {
    const { type } = req.params; // 'email' or 'sms' or 'all'

    // Find users with listings but no boosted items
    const usersWithListings = await User.find({
      $or: [{ role: "landlord" }, { role: "seller" }, { role: "mover" }],
    });

    let notificationCount = 0;

    for (const user of usersWithListings) {
      let hasBoostedItems = false;
      let itemCount = 0;

      // Check based on user role
      if (user.role === "landlord") {
        const properties = await Property.find({ owner: user._id });
        itemCount = properties.length;
        hasBoostedItems = properties.some((p) => p.isFeatured);
      } else if (user.role === "seller") {
        const materials = await Material.find({ seller: user._id });
        itemCount = materials.length;
        hasBoostedItems = materials.some((m) => m.isFeatured);
      } else if (user.role === "mover") {
        hasBoostedItems = user.isFeaturedMover;
        itemCount = 1; // Movers have profile
      }

      // Only notify if they have items but none are boosted
      if (itemCount > 0 && !hasBoostedItems) {
        const message = getBoostReminderMessage(user.role);
        
        if (type === "email" || type === "all") {
          if (user.email) {
            await sendEmail({
              to: user.email,
              subject: "Boost Your Listings on AXX Space!",
              html: message.email,
            });
            notificationCount++;
          }
        }

        if (type === "sms" || type === "all") {
          if (user.phone) {
            await sendSMS({
              to: user.phone,
              message: message.sms,
            });
            notificationCount++;
          }
        }
      }
    }

    res.json({
      success: true,
      message: `Sent ${notificationCount} boost reminder notifications`,
      count: notificationCount,
    });
  } catch (error) {
    console.error("Error sending boost reminders:", error);
    res.status(500).json({ error: error.message });
  }
};

// ====================== GET BOOST REMINDER MESSAGE ======================
const getBoostReminderMessage = (role) => {
  const messages = {
    landlord: {
      email: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #C9A84C;">Boost Your Property on AXX Space!</h2>
          <p>Hi there!</p>
          <p>Get more visibility for your property by boosting it on AXX Space. Boosted properties appear on our homepage and get 10x more views!</p>
          <h3>Boost Pricing:</h3>
          <ul>
            <li><strong>KES 100</strong> - 3 Weeks</li>
            <li><strong>KES 700</strong> - 4 Months</li>
            <li><strong>KES 1000</strong> - 6 Months</li>
          </ul>
          <p>Don't miss out on potential tenants!</p>
          <a href="https://axxspace.com/listings" style="background: #C9A84C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Boost Now</a>
        </div>
      `,
      sms: "Boost your property on AXX Space! Get 10x more views. Plans from KES 100 for 3 weeks. Visit axxspace.com to boost now!",
    },
    seller: {
      email: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #38BDF8;">Boost Your Items on AXX Space!</h2>
          <p>Hi there!</p>
          <p>Get more visibility for your items by boosting them on AXX Space. Boosted items appear on our homepage and get more sales!</p>
          <h3>Boost Pricing:</h3>
          <ul>
            <li><strong>KES 100</strong> - 3 Weeks</li>
            <li><strong>KES 700</strong> - 4 Months</li>
            <li><strong>KES 1000</strong> - 6 Months</li>
          </ul>
          <p>Don't miss out on potential buyers!</p>
          <a href="https://axxspace.com/materials" style="background: #38BDF8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Boost Now</a>
        </div>
      `,
      sms: "Boost your items on AXX Space! Get more sales. Plans from KES 100 for 3 weeks. Visit axxspace.com to boost now!",
    },
    mover: {
      email: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #60A5FA;">Boost Your Profile on AXX Space!</h2>
          <p>Hi there!</p>
          <p>Get more visibility for your moving services by boosting your profile on AXX Space. Boosted movers appear at the top of search results!</p>
          <h3>Boost Pricing:</h3>
          <ul>
            <li><strong>KES 100</strong> - 3 Weeks</li>
            <li><strong>KES 700</strong> - 4 Months</li>
            <li><strong>KES 1000</strong> - 6 Months</li>
          </ul>
          <p>Don't miss out on potential customers!</p>
          <a href="https://axxspace.com/movers/dashboard" style="background: #60A5FA; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Boost Now</a>
        </div>
      `,
      sms: "Boost your mover profile on AXX Space! Get more customers. Plans from KES 100 for 3 weeks. Visit axxspace.com to boost now!",
    },
  };

  return messages[role] || messages.landlord;
};

// ====================== SCHEDULED BOOST REMINDERS (CRON JOB) ======================
export const scheduledBoostReminders = async () => {
  try {
    console.log("Running scheduled boost reminder check...");
    
    // Find users who haven't boosted in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const usersToRemind = await User.find({
      $or: [
        { role: "landlord" },
        { role: "seller" },
        { role: "mover" },
      ],
      $or: [
        { lastBoostReminder: { $exists: false } },
        { lastBoostReminder: { $lt: thirtyDaysAgo } },
      ],
    });

    let reminderCount = 0;

    for (const user of usersToRemind) {
      let hasBoostedItems = false;
      let itemCount = 0;

      // Check based on user role
      if (user.role === "landlord") {
        const properties = await Property.find({ owner: user._id });
        itemCount = properties.length;
        hasBoostedItems = properties.some((p) => p.isFeatured);
      } else if (user.role === "seller") {
        const materials = await Material.find({ seller: user._id });
        itemCount = materials.length;
        hasBoostedItems = materials.some((m) => m.isFeatured);
      } else if (user.role === "mover") {
        hasBoostedItems = user.isFeaturedMover;
        itemCount = 1;
      }

      // Only remind if they have items but none are boosted
      if (itemCount > 0 && !hasBoostedItems) {
        const message = getBoostReminderMessage(user.role);
        
        // Send email
        if (user.email) {
          try {
            await sendEmail({
              to: user.email,
              subject: "Boost Your Listings on AXX Space!",
              html: message.email,
            });
            reminderCount++;
          } catch (emailError) {
            console.error(`Failed to send email to ${user.email}:`, emailError);
          }
        }

        // Update last reminder date
        user.lastBoostReminder = new Date();
        await user.save();
      }
    }

    console.log(`Sent ${reminderCount} boost reminder notifications`);
    return { success: true, count: reminderCount };
  } catch (error) {
    console.error("Error in scheduled boost reminders:", error);
    return { success: false, error: error.message };
  }
};
