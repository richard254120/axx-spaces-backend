const Property = require('../models/Property');

exports.createProperty = async (req, res) => {
  try {
    // ✅ Strict Whitelist - Prevents Mass Assignment
    const allowedFields = [
      'title', 'county', 'area', 'price', 'deposit', 'type',
      'bedrooms', 'bathrooms', 'description', 'phone',
      'amenities', 'lat', 'lng'
    ];

    const propertyData = {};

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        propertyData[field] = req.body[field];
      }
    });

    // Force security fields
    propertyData.owner = req.user.id;
    propertyData.status = "pending";

    // Handle images (if using multer)
    if (req.files && req.files.length > 0) {
      propertyData.images = req.files.map(file => file.path);
    }

    const newProperty = await Property.create(propertyData);

    res.status(201).json({
      success: true,
      message: "Property submitted successfully for approval",
      data: newProperty
    });

  } catch (error) {
    console.error("Property Creation Error:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to create property"
    });
  }
};