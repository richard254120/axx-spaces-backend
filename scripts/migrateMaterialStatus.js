import mongoose from "mongoose";
import Material from "../models/Material.js";
import dotenv from "dotenv";

dotenv.config();

const migrateMaterialStatus = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find all materials with status "active" and change to "approved"
    const activeMaterials = await Material.find({ status: "active" });
    console.log(`Found ${activeMaterials.length} materials with status 'active'`);

    for (const material of activeMaterials) {
      await Material.findByIdAndUpdate(material._id, { status: "approved" });
      console.log(`Updated material ${material.title} from 'active' to 'approved'`);
    }

    console.log("✅ Material migration completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration error:", error);
    process.exit(1);
  }
};

migrateMaterialStatus();
