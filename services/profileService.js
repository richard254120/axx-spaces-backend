import User from "../models/User.js";
import { formatUserResponse } from "../utils/formatUser.js";

function parseJsonField(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export async function getUserProfile(userId) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }
  return formatUserResponse(user);
}

export async function updateUserProfile(userId, body, avatarFile) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  if (body.name !== undefined && body.name !== "") user.name = body.name.trim();
  if (body.phone !== undefined && body.phone !== "") user.phone = body.phone.trim();

  if (avatarFile) {
    const url = avatarFile.path || avatarFile.secure_url;
    if (url) user.profileImage = url;
  } else if (body.removeProfileImage === "true") {
    user.profileImage = "";
  }

  if (user.role === "mover") {
    if (body.county !== undefined) user.county = body.county.trim();
    if (body.vehicleType !== undefined) user.vehicleType = body.vehicleType;
    if (body.experienceYears !== undefined && body.experienceYears !== "") {
      user.experienceYears = parseInt(body.experienceYears) || 0;
    }
    if (body.services !== undefined) {
      user.services = parseJsonField(body.services, user.services || []);
    }
    if (body.description !== undefined || body.bio !== undefined) {
      user.description = (body.description || body.bio || "").trim();
    }
  }

  if (["landlord", "seller", "user"].includes(user.role) && body.county !== undefined) {
    user.county = body.county.trim();
  }

  await user.save();
  return formatUserResponse(user);
}
