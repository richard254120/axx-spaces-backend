import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import User from "./models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the backend directory
dotenv.config({ path: path.join(__dirname, '.env') });

const checkUser = async (email) => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find user by email
    const user = await User.findOne({ email }).select("name email phone role isEmailVerified isApproved _id");
    
    if (!user) {
      console.log(`❌ No user found with email: ${email}`);
    } else {
      console.log(`\n👤 User found:\n`);
      console.log(`Name: ${user.name}`);
      console.log(`Email: ${user.email}`);
      console.log(`Phone: ${user.phone}`);
      console.log(`Role: ${user.role}`);
      console.log(`Email Verified: ${user.isEmailVerified}`);
      console.log(`Approved: ${user.isApproved}`);
      console.log(`ID: ${user._id}`);
      
      if (user.role !== "admin") {
        console.log(`\n⚠️ WARNING: User has role "${user.role}" but needs role "admin" to access admin panel`);
      } else {
        console.log(`\n✅ User has admin role and should be able to login`);
      }
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error checking user:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Get email from command line
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log("Usage: node checkUser.js <email>");
  console.log("Example: node checkUser.js user@example.com");
  process.exit(1);
}

const email = args[0];
checkUser(email);