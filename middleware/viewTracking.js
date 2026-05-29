// View tracking middleware
import Property from "../models/Property.js";
import Material from "../models/Material.js";
import TourismListing from "../models/TourismListing.js";

// Track views for properties
export const trackPropertyView = async (req, res, next) => {
  try {
    const propertyId = req.params.id;
    
    // Only track views for GET requests on individual properties
    if (req.method === 'GET' && propertyId) {
      await Property.findByIdAndUpdate(
        propertyId,
        { $inc: { views: 1 } },
        { new: false }
      );
    }
    
    next();
  } catch (error) {
    console.error("Error tracking property view:", error);
    next(); // Continue even if tracking fails
  }
};

// Track views for materials
export const trackMaterialView = async (req, res, next) => {
  try {
    const materialId = req.params.id;
    
    // Only track views for GET requests on individual materials
    if (req.method === 'GET' && materialId) {
      await Material.findByIdAndUpdate(
        materialId,
        { $inc: { views: 1 } },
        { new: false }
      );
    }
    
    next();
  } catch (error) {
    console.error("Error tracking material view:", error);
    next(); // Continue even if tracking fails
  }
};

// Track views for tourism listings
export const trackTourismView = async (req, res, next) => {
  try {
    const tourismId = req.params.id;
    
    // Only track views for GET requests on individual tourism listings
    if (req.method === 'GET' && tourismId) {
      await TourismListing.findByIdAndUpdate(
        tourismId,
        { $inc: { views: 1 } },
        { new: false }
      );
    }
    
    next();
  } catch (error) {
    console.error("Error tracking tourism view:", error);
    next(); // Continue even if tracking fails
  }
};

// Generic view tracker for any model
export const trackView = (model) => {
  return async (req, res, next) => {
    try {
      const id = req.params.id;
      
      if (req.method === 'GET' && id) {
        await model.findByIdAndUpdate(
          id,
          { $inc: { views: 1 } },
          { new: false }
        );
      }
      
      next();
    } catch (error) {
      console.error("Error tracking view:", error);
      next();
    }
  };
};

export default {
  trackPropertyView,
  trackMaterialView,
  trackTourismView,
  trackView
};
