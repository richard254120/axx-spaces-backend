import mongoose from "mongoose";
import Material from "../models/Material.js";
import Review from "../models/Review.js";
import dotenv from "dotenv";

dotenv.config();

const migrateMaterialRatings = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/axx-spaces");
    console.log("✅ Connected to MongoDB");

    // Fetch all materials
    const materials = await Material.find({});
    console.log(`📦 Found ${materials.length} materials`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const material of materials) {
      // Fetch reviews for this material (category: "merchant", relatedId: material._id)
      const reviews = await Review.find({
        category: "merchant",
        relatedId: material._id,
        isApproved: true,
      });

      const reviewCount = reviews.length;
      
      // Calculate average rating
      let averageRating = 0;
      if (reviewCount > 0) {
        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        averageRating = totalRating / reviewCount;
      }

      // Update material with rating and reviewCount
      await Material.findByIdAndUpdate(material._id, {
        rating: averageRating,
        reviewCount: reviewCount,
      });

      console.log(`✅ Updated material "${material.title}": Rating=${averageRating.toFixed(1)}, Reviews=${reviewCount}`);
      updatedCount++;
    }

    console.log(`\n🎉 Migration complete!`);
    console.log(`✅ Updated: ${updatedCount} materials`);
    console.log(`⏭️ Skipped: ${skippedCount} materials`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration error:", error);
    process.exit(1);
  }
};

migrateMaterialRatings();
