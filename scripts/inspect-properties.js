import mongoose from "mongoose";
import Property from "../models/Property.js";
import dotenv from "dotenv";

dotenv.config();

const inspect = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const count = await Property.countDocuments();
    console.log(`Total properties in DB: ${count}`);

    const properties = await Property.find().limit(20);
    properties.forEach((p, index) => {
      console.log(`${index + 1}. Title: "${p.title}" | Location: "${p.location}" | Type: "${p.propertyType}" | Price: ${p.price} | NearbyUniv: "${p.nearbyUniversity || 'none'}"`);
    });

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

inspect();
