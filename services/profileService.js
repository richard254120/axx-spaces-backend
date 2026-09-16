import bcrypt from "bcrypt";
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

export async function changeUserPassword(userId, currentPassword, newPassword) {
  const user = await User.findById(userId).select("+password");
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    const err = new Error("Current password is incorrect");
    err.status = 400;
    throw err;
  }

  if (!newPassword || newPassword.length < 6) {
    const err = new Error("New password must be at least 6 characters");
    err.status = 400;
    throw err;
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
  return { message: "Password changed successfully" };
}

export async function changeUserEmail(userId, newEmail, password) {
  const user = await User.findById(userId).select("+password");
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const err = new Error("Password is incorrect");
    err.status = 400;
    throw err;
  }

  const existing = await User.findOne({ email: newEmail, role: user.role });
  if (existing && existing._id.toString() !== userId.toString()) {
    const err = new Error("This email is already in use");
    err.status = 400;
    throw err;
  }

  user.email = newEmail.trim().toLowerCase();
  user.isEmailVerified = false;
  await user.save();
  return formatUserResponse(user);
}
