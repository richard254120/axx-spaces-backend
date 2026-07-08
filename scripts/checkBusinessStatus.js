import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkBusinessStatus() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const Business = mongoose.model('Business', new mongoose.Schema({}, { strict: false }), 'businesses');

    // Get all businesses
    const businesses = await Business.find({}, { name: 1, status: 1, isApproved: 1, featured: 1 }).sort({ createdAt: -1 });

    console.log(`\n📊 Total businesses: ${businesses.length}\n`);

    // Count by status
    const statusCounts = {
      pending: 0,
      approved: 0,
      rejected: 0,
      suspended: 0,
      other: 0
    };

    const isApprovedCounts = {
      true: 0,
      false: 0
    };

    const featuredCounts = {
      true: 0,
      false: 0
    };

    const mismatched = [];

    businesses.forEach(b => {
      // Count status
      if (statusCounts[b.status] !== undefined) {
        statusCounts[b.status]++;
      } else {
        statusCounts.other++;
      }

      // Count isApproved
      isApprovedCounts[b.isApproved ? 'true' : 'false']++;

      // Count featured
      featuredCounts[b.featured ? 'true' : 'false']++;

      // Check for mismatches
      if (b.isApproved === true && b.status !== 'approved') {
        mismatched.push({ name: b.name, isApproved: b.isApproved, status: b.status, featured: b.featured });
      }
      if (b.isApproved === false && b.status === 'approved') {
        mismatched.push({ name: b.name, isApproved: b.isApproved, status: b.status, featured: b.featured });
      }
    });

    console.log('📈 Status distribution:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    console.log('\n📈 isApproved distribution:');
    console.log(`   true: ${isApprovedCounts.true}`);
    console.log(`   false: ${isApprovedCounts.false}`);

    console.log('\n📈 Featured distribution:');
    console.log(`   true: ${featuredCounts.true}`);
    console.log(`   false: ${featuredCounts.false}`);

    if (mismatched.length > 0) {
      console.log('\n⚠️  MISMATCHED businesses (isApproved != status):');
      mismatched.forEach(b => {
        console.log(`   ${b.name}: isApproved=${b.isApproved}, status=${b.status}, featured=${b.featured}`);
      });
    } else {
      console.log('\n✅ No mismatches found between isApproved and status');
    }

    // Show sample of approved businesses
    const approvedBusinesses = businesses.filter(b => b.status === 'approved');
    console.log(`\n📋 Sample approved businesses (first 10):`);
    approvedBusinesses.slice(0, 10).forEach(b => {
      console.log(`   ${b.name}: status=${b.status}, isApproved=${b.isApproved}, featured=${b.featured}`);
    });

    // Show sample of featured businesses
    const featuredBusinesses = businesses.filter(b => b.featured === true);
    console.log(`\n📋 Featured businesses (${featuredBusinesses.length}):`);
    featuredBusinesses.forEach(b => {
      console.log(`   ${b.name}: status=${b.status}, isApproved=${b.isApproved}, featured=${b.featured}`);
    });

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkBusinessStatus();
