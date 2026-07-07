import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the backend directory
dotenv.config({ path: path.join(__dirname, '.env') });

const removeRoleConstraints = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    const usersCollection = db.collection("users");

    console.log("\n🔍 Checking current indexes on 'users' collection...");
    const indexes = await usersCollection.indexes();
    console.log("Current indexes:");
    indexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log("\n🗑️ Removing compound unique indexes that block role changes...");

    // Remove phone+role compound unique index
    try {
      await usersCollection.dropIndex("phone_1_role_1");
      console.log("   ✅ Dropped index: phone_1_role_1");
    } catch (err) {
      if (err.code === 26) {
        console.log("   ℹ️  Index phone_1_role_1 does not exist (already removed)");
      } else {
        console.log("   ⚠️  Error dropping phone_1_role_1:", err.message);
      }
    }

    // Remove email+role compound unique index
    try {
      await usersCollection.dropIndex("email_1_role_1");
      console.log("   ✅ Dropped index: email_1_role_1");
    } catch (err) {
      if (err.code === 26) {
        console.log("   ℹ️  Index email_1_role_1 does not exist (already removed)");
      } else {
        console.log("   ⚠️  Error dropping email_1_role_1:", err.message);
      }
    }

    console.log("\n🔍 Checking indexes after removal...");
    const newIndexes = await usersCollection.indexes();
    console.log("Updated indexes:");
    newIndexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log("\n✅ Role constraints removed successfully!");
    console.log("\n💡 Now you can change user roles in the database without conflicts.");
    console.log("   Simply update a user's role to 'admin' and they can login immediately.");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error removing role constraints:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

removeRoleConstraints();