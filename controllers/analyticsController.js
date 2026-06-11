import Property from "../models/Property.js";
import Material from "../models/Material.js";
import TourismListing from "../models/TourismListing.js";
import User from "../models/User.js";
import Business from "../models/Business.js";

// @desc    Get demographic data
// @route   GET /api/analytics/demographics
// @access  Public
export const getDemographics = async (req, res) => {
  try {
    // Get county data from all services
    const propertyCounties = await Property.aggregate([
      { $group: { _id: "$county", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const materialCounties = await Material.aggregate([
      { $group: { _id: "$county", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const tourismCounties = await TourismListing.aggregate([
      { $group: { _id: "$county", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Combine all county data
    const allCounties = {};
    
    propertyCounties.forEach(item => {
      allCounties[item._id] = (allCounties[item._id] || 0) + item.count;
    });
    
    materialCounties.forEach(item => {
      allCounties[item._id] = (allCounties[item._id] || 0) + item.count;
    });
    
    tourismCounties.forEach(item => {
      allCounties[item._id] = (allCounties[item._id] || 0) + item.count;
    });

    // Convert to array and sort
    const countyData = Object.entries(allCounties)
      .map(([county, count]) => ({ county, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 counties

    // Get service popularity data
    const propertyCount = await Property.countDocuments();
    const materialCount = await Material.countDocuments();
    const tourismCount = await TourismListing.countDocuments();
    const businessCount = await Business.countDocuments();
    const userCount = await User.countDocuments();

    const serviceData = [
      { service: "Properties", count: propertyCount },
      { service: "Materials", count: materialCount },
      { service: "Tourism", count: tourismCount },
      { service: "Businesses", count: businessCount },
      { service: "Users", count: userCount },
    ].sort((a, b) => b.count - a.count);

    // Get user location data (if available)
    const userLocations = await User.aggregate([
      { $match: { location: { $exists: true, $ne: "" } } },
      { $group: { _id: "$location", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        counties: countyData,
        services: serviceData,
        userLocations: userLocations,
        totalListings: propertyCount + materialCount + tourismCount + businessCount,
        totalUsers: userCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get demographic data",
    });
  }
};
