import * as profileService from "../services/profileService.js";
import { handleServiceError } from "../utils/tourismHttp.js";

export const getProfile = async (req, res) => {
  try {
    const user = await profileService.getUserProfile(req.user._id);
    return res.json({ success: true, data: { user } });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const updateProfile = async (req, res) => {
  try {
    const user = await profileService.updateUserProfile(
      req.user._id,
      req.body,
      req.file
    );
    return res.json({
      success: true,
      message: "Profile updated successfully",
      data: { user },
    });
  } catch (error) {
    return handleServiceError(res, error);
  }
};
