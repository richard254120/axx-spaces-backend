import mongoose from "mongoose";
import Material from "../models/Material.js";
import dotenv from "dotenv";

dotenv.config();

const fixMaterialStatus = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Change "active" to "approved"
    const activeMaterials = await Material.find({ status: "active" });
    console.log(`Found ${activeMaterials.length} materials with status 'active'`);

    for (const material of activeMaterials) {
      await Material.findByIdAndUpdate(material._id, { status: "approved" });
      console.log(`Updated "${material.title}" from 'active' to 'approved'`);
    }

    // "sold" status is valid in the new enum, so no change needed
    const soldMaterials = await Material.find({ status: "sold" });
    console.log(`Found ${soldMaterials.length} materials with status 'sold' (no change needed)`);

    console.log("\n✅ Material status fix completed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

fixMaterialStatus();
