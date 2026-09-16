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

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await profileService.changeUserPassword(
      req.user._id,
      currentPassword,
      newPassword
    );
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const changeEmail = async (req, res) => {
  try {
    const { newEmail, password } = req.body;
    const user = await profileService.changeUserEmail(
      req.user._id,
      newEmail,
      password
    );
    return res.json({ success: true, message: "Email updated successfully", data: { user } });
  } catch (error) {
    return handleServiceError(res, error);
  }
};
