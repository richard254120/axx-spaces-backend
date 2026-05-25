import * as tourismService from "../services/tourismService.js";
import { sendSuccess, handleServiceError } from "../utils/tourismHttp.js";
import { sendTourismRegistrationEmail } from "../utils/email.js";

export const getListings = async (req, res) => {
  try {
    const { count, items } = await tourismService.listListings(req.query);
    return res.json({ success: true, count, data: items });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const getFeatured = async (req, res) => {
  try {
    const data = await tourismService.listFeatured(req.query.limit);
    return sendSuccess(res, data);
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const getStats = async (req, res) => {
  try {
    const data = await tourismService.getPlatformStats();
    return sendSuccess(res, data);
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const getCategories = async (req, res) => {
  try {
    const data = await tourismService.listCategories();
    return sendSuccess(res, data);
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const getListingById = async (req, res) => {
  try {
    const data = await tourismService.getListingById(req.params.id, req.user);
    return sendSuccess(res, data);
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const getMyListings = async (req, res) => {
  try {
    const data = await tourismService.listByOwner(req.user._id);
    return sendSuccess(res, data);
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const createListing = async (req, res) => {
  try {
    const data = await tourismService.createListing(req.body, req.user, req.files || []);
    return res.status(201).json({
      success: true,
      message: "Property submitted for review. Our team will contact you within 24 hours.",
      data,
    });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const registerProviderListing = async (req, res) => {
  try {
    const { listing, token, user } = await tourismService.registerProviderAndListing(
      req.body,
      req.files || []
    );
    await sendTourismRegistrationEmail(req.body);
    return res.status(201).json({
      success: true,
      message: "Account created and property submitted for review.",
      token,
      user,
      data: listing,
    });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const addReview = async (req, res) => {
  try {
    const data = await tourismService.addReview(req.params.id, req.body);
    return res.status(201).json({ success: true, message: "Review submitted", data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const incrementView = async (req, res) => {
  try {
    await tourismService.recordView(req.params.id);
    return res.json({ success: true });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const getOwnerProfile = async (req, res) => {
  try {
    const data = await tourismService.getOwnerProfile(req.user._id);
    return sendSuccess(res, data);
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const updateOwnerProfile = async (req, res) => {
  try {
    const user = await tourismService.updateOwnerProfile(req.user._id, req.body, req.file);
    return res.json({
      success: true,
      message: "Profile updated successfully",
      data: { user },
    });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const getOwnerListing = async (req, res) => {
  try {
    const data = await tourismService.getOwnerListing(req.params.id, req.user._id);
    return sendSuccess(res, data);
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const updateOwnerListing = async (req, res) => {
  try {
    const uploaded = [
      ...(req.files?.images || []),
      ...(req.files?.videos || []),
    ];
    const data = await tourismService.updateOwnerListing(
      req.params.id,
      req.user._id,
      req.body,
      uploaded
    );
    return res.json({
      success: true,
      message: data.status === "pending"
        ? "Changes saved. Your property will be reviewed again before going live."
        : "Property updated successfully.",
      data,
    });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const updateListingStatus = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, error: "Admin only" });
    }
    const data = await tourismService.updateStatus(
      req.params.id,
      req.body.status,
      req.body.isFeatured ?? false
    );
    return sendSuccess(res, data);
  } catch (error) {
    return handleServiceError(res, error);
  }
};
