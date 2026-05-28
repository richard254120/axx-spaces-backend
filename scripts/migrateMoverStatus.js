import mongoose from "mongoose";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

const migrateMoverStatus = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find all movers without a status field
    const moversWithoutStatus = await User.find({ 
      role: "mover", 
      status: { $exists: false } 
    });

    console.log(`Found ${moversWithoutStatus.length} movers without status field`);

    // Update each mover
    for (const mover of moversWithoutStatus) {
      const status = mover.isApproved ? "approved" : "pending";
      await User.findByIdAndUpdate(mover._id, { status });
      console.log(`Updated mover ${mover.email} to status: ${status}`);
    }

    // Also update movers who have isApproved: false but status might be wrong
    const moversToFix = await User.find({ 
      role: "mover", 
      isApproved: false, 
      status: { $ne: "pending" } 
    });

    console.log(`Found ${moversToFix.length} movers with incorrect status`);

    for (const mover of moversToFix) {
      await User.findByIdAndUpdate(mover._id, { status: "pending" });
      console.log(`Fixed mover ${mover.email} to status: pending`);
    }

    console.log("✅ Migration completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration error:", error);
    process.exit(1);
  }
};

migrateMoverStatus();
