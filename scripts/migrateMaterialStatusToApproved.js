import mongoose from "mongoose";
import dotenv from "dotenv";
import Material from "../models/Material.js";

dotenv.config();

const migrateMaterialStatus = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find all materials with status "active" and update to "approved"
    const result = await Material.updateMany(
      { status: "active" },
      { status: "approved" }
    );

    console.log(`✅ Updated ${result.modifiedCount} materials from "active" to "approved"`);

    // Check current status distribution
    const materials = await Material.find({});
    const statusCounts = {};
    materials.forEach(m => {
      statusCounts[m.status] = (statusCounts[m.status] || 0) + 1;
    });

    console.log("\nCurrent status distribution:");
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration error:", error);
    process.exit(1);
  }
};

migrateMaterialStatus();
