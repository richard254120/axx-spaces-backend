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

const testRoleChange = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Create a test user with landlord role
    const testEmail = "testlandlord@axxspace.com";
    const testPassword = "testpassword123";
    const testName = "Test Landlord";
    const testPhone = "0712345678";

    console.log(`\n🧪 Testing role change scenario\n`);

    // Step 1: Create a test user with landlord role
    console.log("Step 1: Creating test user with landlord role...");
    let user = await User.findOne({ email: testEmail });
    
    if (user) {
      console.log("   User already exists, updating password...");
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      user.password = hashedPassword;
      user.role = "landlord";
      user.isEmailVerified = true;
      user.isApproved = true;
      await user.save();
    } else {
      console.log("   Creating new landlord user...");
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      user = new User({
        name: testName,
        email: testEmail,
        password: hashedPassword,
        phone: testPhone,
        role: "landlord",
        isEmailVerified: true,
        isApproved: true,
      });
      await user.save();
    }
    
    console.log(`   ✅ User created/updated with role: ${user.role}`);

    // Step 2: Try to login as landlord (should fail for admin panel)
    console.log("\nStep 2: Testing login with landlord role...");
    const loginResponse1 = await fetch('http://localhost:1000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword, role: "admin" })
    });
    
    const loginData1 = await loginResponse1.json();
    console.log(`   Status: ${loginResponse1.status}`);
    console.log(`   Response: ${loginData1.error || "Success"}`);
    
    if (loginResponse1.status === 401) {
      console.log("   ✅ Correctly rejected - landlord cannot login as admin");
    }

    // Step 3: Change role to admin in database
    console.log("\nStep 3: Changing user role to admin in database...");
    user.role = "admin";
    await user.save();
    console.log(`   ✅ Role changed to: ${user.role}`);

    // Step 4: Try to login as admin (should succeed)
    console.log("\nStep 4: Testing login with admin role...");
    const loginResponse2 = await fetch('http://localhost:1000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword, role: "admin" })
    });
    
    const loginData2 = await loginResponse2.json();
    console.log(`   Status: ${loginResponse2.status}`);
    console.log(`   Response: ${loginData2.error || "Success"}`);
    
    if (loginResponse2.status === 200) {
      console.log("   ✅ Successfully logged in as admin after role change!");
      console.log(`   Token: ${loginData2.token.substring(0, 50)}...`);
      console.log(`   User: ${loginData2.user.name} (${loginData2.user.role})`);
    } else {
      console.log("   ❌ Failed to login after role change - NEEDS FIX");
    }

    // Cleanup - change back to landlord
    console.log("\nStep 5: Cleaning up - changing role back to landlord...");
    user.role = "landlord";
    await user.save();
    console.log("   ✅ Role restored to landlord");

    console.log("\n🎯 Conclusion:");
    console.log("   The system should allow role changes in database to immediately");
    console.log("   grant admin access without password changes or additional setup.");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error testing role change:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

testRoleChange();