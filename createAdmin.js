import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Admin credentials
    const adminEmail = "admin@axxspace.com";
    const adminPassword = "axxspaceadmin1";
    const adminName = "AxxSpace Admin";

    // Check if admin already exists
    let admin = await User.findOne({ email: adminEmail, role: "admin" });

    if (admin) {
      // Update existing admin password
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      admin.password = hashedPassword;
      admin.name = adminName;
      admin.role = "admin";
      admin.isEmailVerified = true;
      admin.isApproved = true;
      await admin.save();
      console.log("✅ Updated existing admin account");
    } else {
      // Create new admin account
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      admin = new User({
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        phone: "0000000000",
        role: "admin",
        isEmailVerified: true,
        isApproved: true,
      });
      await admin.save();
      console.log("✅ Created new admin account");
    }

    console.log("📧 Admin Email:", adminEmail);
    console.log("🔑 Admin Password:", adminPassword);
    console.log("✅ Admin account setup complete!");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

createAdmin();
