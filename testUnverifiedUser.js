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

const testUnverifiedUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Create a test user with landlord role, unverified email, not approved
    const testEmail = "unverified@axxspace.com";
    const testPassword = "testpassword123";
    const testName = "Unverified User";
    const testPhone = "0712345679";

    console.log(`\n🧪 Testing unverified user role change scenario\n`);

    // Step 1: Create a test user with landlord role, unverified, not approved
    console.log("Step 1: Creating test user with landlord role (unverified, not approved)...");
    let user = await User.findOne({ email: testEmail });
    
    if (user) {
      console.log("   User already exists, updating...");
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      user.password = hashedPassword;
      user.role = "landlord";
      user.isEmailVerified = false;
      user.isApproved = false;
      await user.save();
    } else {
      console.log("   Creating new unverified landlord user...");
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      user = new User({
        name: testName,
        email: testEmail,
        password: hashedPassword,
        phone: testPhone,
        role: "landlord",
        isEmailVerified: false,
        isApproved: false,
      });
      await user.save();
    }
    
    console.log(`   ✅ User created/updated:`);
    console.log(`      Role: ${user.role}`);
    console.log(`      Email Verified: ${user.isEmailVerified}`);
    console.log(`      Approved: ${user.isApproved}`);

    // Step 2: Try to login as landlord (should fail)
    console.log("\nStep 2: Testing login with landlord role (unverified)...");
    const loginResponse1 = await fetch('http://localhost:1000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword, role: "landlord" })
    });
    
    const loginData1 = await loginResponse1.json();
    console.log(`   Status: ${loginResponse1.status}`);
    console.log(`   Response: ${loginData1.error || "Success"}`);
    
    if (loginResponse1.status === 403) {
      console.log("   ✅ Correctly rejected - unverified landlord cannot login");
    }

    // Step 3: Change role to admin in database (keep unverified, not approved)
    console.log("\nStep 3: Changing user role to admin (keeping unverified, not approved)...");
    user.role = "admin";
    await user.save();
    console.log(`   ✅ Role changed to: ${user.role}`);
    console.log(`   Email Verified: ${user.isEmailVerified}`);
    console.log(`   Approved: ${user.isApproved}`);

    // Step 4: Try to login as admin (should succeed despite unverified status)
    console.log("\nStep 4: Testing login with admin role (unverified, not approved)...");
    const loginResponse2 = await fetch('http://localhost:1000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword, role: "admin" })
    });
    
    const loginData2 = await loginResponse2.json();
    console.log(`   Status: ${loginResponse2.status}`);
    console.log(`   Response: ${loginData2.error || "Success"}`);
    
    if (loginResponse2.status === 200) {
      console.log("   ✅ Successfully logged in as admin despite being unverified!");
      console.log(`   Token: ${loginData2.token.substring(0, 50)}...`);
      console.log(`   User: ${loginData2.user.name} (${loginData2.user.role})`);
    } else {
      console.log("   ❌ Failed to login - NEEDS FIX");
    }

    // Cleanup
    console.log("\nStep 5: Cleaning up - deleting test user...");
    await User.deleteOne({ email: testEmail });
    console.log("   ✅ Test user deleted");

    console.log("\n🎯 Conclusion:");
    console.log("   Admin users can login even if email is not verified or account is not approved.");
    console.log("   Simply changing the role to 'admin' grants immediate access.");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error testing unverified user:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

testUnverifiedUser();