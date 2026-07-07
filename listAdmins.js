import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import User from "./models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the backend directory
dotenv.config({ path: path.join(__dirname, '.env') });

const listAdmins = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find all admin users
    const admins = await User.find({ role: "admin" }).select("name email phone role isEmailVerified isApproved _id");
    
    console.log(`\n📋 Found ${admins.length} admin users:\n`);
    
    if (admins.length === 0) {
      console.log("❌ No admin users found in database");
    } else {
      admins.forEach((admin, index) => {
        console.log(`${index + 1}. Name: ${admin.name}`);
        console.log(`   Email: ${admin.email}`);
        console.log(`   Phone: ${admin.phone}`);
        console.log(`   Role: ${admin.role}`);
        console.log(`   Email Verified: ${admin.isEmailVerified}`);
        console.log(`   Approved: ${admin.isApproved}`);
        console.log(`   ID: ${admin._id}`);
        console.log("");
      });
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error listing admins:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

listAdmins();