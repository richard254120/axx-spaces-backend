import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import User from "./models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the backend directory
dotenv.config({ path: path.join(__dirname, '.env') });

const addAdmin = async (email, password, name, phone) => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Check if admin already exists
    let admin = await User.findOne({ email, role: "admin" });

    if (admin) {
      // Update existing admin
      const hashedPassword = await bcrypt.hash(password, 10);
      admin.password = hashedPassword;
      admin.name = name || admin.name;
      admin.phone = phone || admin.phone;
      admin.role = "admin";
      admin.isEmailVerified = true;
      admin.isApproved = true;
      await admin.save();
      console.log("✅ Updated existing admin account");
    } else {
      // Create new admin account
      const hashedPassword = await bcrypt.hash(password, 10);
      admin = new User({
        name: name || "Admin User",
        email: email,
        password: hashedPassword,
        phone: phone || "0000000000",
        role: "admin",
        isEmailVerified: true,
        isApproved: true,
      });
      await admin.save();
      console.log("✅ Created new admin account");
    }

    console.log("📧 Admin Email:", email);
    console.log("🔑 Admin Password:", password);
    console.log("👤 Admin Name:", admin.name);
    console.log("📱 Admin Phone:", admin.phone);
    console.log("✅ Admin account setup complete!");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding admin:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log("Usage: node addAdmin.js <email> <password> [name] [phone]");
  console.log("Example: node addAdmin.js john@example.com password123 \"John Doe\" \"0712345678\"");
  process.exit(1);
}

const [email, password, name, phone] = args;
addAdmin(email, password, name, phone);