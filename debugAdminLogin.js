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

const debugAdminLogin = async (email, password) => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    console.log(`\n🔍 Debugging login for: ${email}\n`);

    // Find user by email
    const user = await User.findOne({ email }).select("+password");
    
    if (!user) {
      console.log(`❌ No user found with email: ${email}`);
      console.log("\n💡 SOLUTION: Create this user as admin:");
      console.log(`   node addAdmin.js ${email} "your_password" "User Name" "phone_number"`);
      return;
    }

    console.log(`👤 User found in database:`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Phone: ${user.phone}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Email Verified: ${user.isEmailVerified}`);
    console.log(`   Approved: ${user.isApproved}`);
    console.log(`   ID: ${user._id}`);

    // Check if user has admin role
    if (user.role !== "admin") {
      console.log(`\n⚠️ WARNING: User has role "${user.role}" but needs role "admin" to access admin panel`);
      console.log("\n💡 SOLUTION: Update user role to admin:");
      console.log(`   node addAdmin.js ${email} "new_password" "${user.name}" "${user.phone}"`);
      return;
    }

    console.log(`\n✅ User has admin role - should be able to login`);

    // Test password if provided
    if (password) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (isPasswordValid) {
        console.log(`\n✅ Password is correct`);
      } else {
        console.log(`\n❌ Password is incorrect`);
        console.log("\n💡 SOLUTION: Reset password:");
        console.log(`   node addAdmin.js ${email} "new_password" "${user.name}" "${user.phone}"`);
        return;
      }
    }

    // Check email verification status
    if (!user.isEmailVerified) {
      console.log(`\n⚠️ WARNING: User email is not verified`);
      console.log("   Admin users should have isEmailVerified: true");
      console.log("\n💡 SOLUTION: Update user verification status in database");
    }

    // Check approval status
    if (!user.isApproved) {
      console.log(`\n⚠️ WARNING: User is not approved`);
      console.log("   Admin users should have isApproved: true");
      console.log("\n💡 SOLUTION: Update user approval status in database");
    }

    console.log(`\n✅ All checks passed - user should be able to login to admin panel`);
    console.log(`\n🌐 Admin panel URL: http://localhost:3000`);
    console.log(`🔗 Backend API: http://localhost:1000/api`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error debugging admin login:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Get email from command line
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log("Usage: node debugAdminLogin.js <email> [password]");
  console.log("Example: node debugAdminLogin.js user@example.com password123");
  console.log("\nThis script will:");
  console.log("1. Check if user exists in database");
  console.log("2. Verify user has admin role");
  console.log("3. Check email verification status");
  console.log("4. Check approval status");
  console.log("5. Test password if provided");
  console.log("6. Provide solutions for any issues found");
  process.exit(1);
}

const [email, password] = args;
debugAdminLogin(email, password);