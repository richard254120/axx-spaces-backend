import mongoose from "mongoose";
import Material from "../models/Material.js";
import dotenv from "dotenv";

dotenv.config();

const checkMaterialStatus = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find all materials and show their status
    const allMaterials = await Material.find({}).select("title status");
    console.log(`\nTotal materials: ${allMaterials.length}\n`);

    allMaterials.forEach(m => {
      console.log(`Title: ${m.title}, Status: ${m.status}`);
    });

    // Count by status
    const pending = await Material.countDocuments({ status: "pending" });
    const approved = await Material.countDocuments({ status: "approved" });
    const active = await Material.countDocuments({ status: "active" });
    const rejected = await Material.countDocuments({ status: "rejected" });

    console.log(`\nStatus counts:`);
    console.log(`Pending: ${pending}`);
    console.log(`Approved: ${approved}`);
    console.log(`Active: ${active}`);
    console.log(`Rejected: ${rejected}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

checkMaterialStatus();
