import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Material from "./models/Material.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load dotenv configuration
dotenv.config({ path: path.join(__dirname, '.env') });

const runMigration = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("❌ MONGO_URI is not defined in .env file.");
      process.exit(1);
    }
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    console.log("Updating existing materials to remove 'condition' field...");
    const result = await Material.updateMany({}, { $unset: { condition: "" } });
    console.log(`✅ Successfully modified ${result.modifiedCount} material document(s).`);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error running migration:", error);
    process.exit(1);
  }
};

runMigration();
