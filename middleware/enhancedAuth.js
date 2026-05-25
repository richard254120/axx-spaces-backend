// enhancedAuth.js - Enhanced JWT Authentication with Refresh Tokens
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import User from "../models/User.js";

// Token blacklist for revoked tokens
const tokenBlacklist = new Map();

// Refresh token store (in production, use Redis or database)
const refreshTokens = new Map();

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  
  // Clean up blacklisted tokens
  tokenBlacklist.forEach((expiry, token) => {
    if (now > expiry) {
      tokenBlacklist.delete(token);
    }
  });
  
  // Clean up refresh tokens
  refreshTokens.forEach((data, token) => {
    if (now > data.expiresAt) {
      refreshTokens.delete(token);
    }
  });
}, 60 * 60 * 1000); // Run every hour

// Generate access token
const generateAccessToken = (userId, userRole) => {
  return jwt.sign(
    { userId, userRole },
    process.env.JWT_SECRET,
    {
      expiresIn: '15m', // Short-lived access token
      issuer: 'axx-spaces',
      audience: 'axx-spaces-api',
      jwtid: randomBytes(16).toString('hex'), // Unique ID for the token
    }
  );
};

// Generate refresh token
const generateRefreshToken = (userId) => {
  const token = randomBytes(64).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  
  refreshTokens.set(token, {
    userId,
    createdAt: Date.now(),
    expiresAt,
  });
  
  return token;
};

// Verify access token
const verifyAccessToken = (token) => {
  try {
    // Check if token is blacklisted
    if (tokenBlacklist.has(token)) {
      throw new Error('Token has been revoked');
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'axx-spaces',
      audience: 'axx-spaces-api',
    });
    
    return decoded;
  } catch (error) {
    throw error;
  }
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  const data = refreshTokens.get(token);
  
  if (!data) {
    throw new Error('Invalid refresh token');
  }
  
  if (Date.now() > data.expiresAt) {
    refreshTokens.delete(token);
    throw new Error('Refresh token expired');
  }
  
  return data;
};

// Revoke token (add to blacklist)
const revokeToken = (token) => {
  try {
    const decoded = jwt.decode(token);
    if (decoded && decoded.exp) {
      const expiry = decoded.exp * 1000;
      tokenBlacklist.set(token, expiry);
    }
  } catch (error) {
    console.error('Error revoking token:', error);
  }
};

// Revoke all user tokens
const revokeAllUserTokens = (userId) => {
  // Revoke all refresh tokens for the user
  for (const [token, data] of refreshTokens.entries()) {
    if (data.userId === userId) {
      refreshTokens.delete(token);
    }
  }
};

// Enhanced protect middleware
export const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ 
        error: "🔐 Access denied. No token provided.",
        code: 'NO_TOKEN'
      });
    }

    // Verify the token
    const decoded = verifyAccessToken(token);

    // Use decoded.userId because JWT is created with userId
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(404).json({ 
        error: "👤 User no longer exists.",
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if user is active
    if (user.isBlocked) {
      return res.status(403).json({ 
        error: "🚫 Account has been blocked",
        code: 'ACCOUNT_BLOCKED'
      });
    }

    // Attach the full user object to the request
    req.user = user;
    req.userId = decoded.userId;
    req.userRole = decoded.userRole;
    req.tokenId = decoded.jti;
    
    next();
  } catch (error) {
    console.error("❌ Auth error:", error.message);
    
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ 
        error: "🔐 Session expired. Please login again.",
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.message === 'Token has been revoked') {
      return res.status(401).json({ 
        error: "🔐 Token has been revoked. Please login again.",
        code: 'TOKEN_REVOKED'
      });
    }
    
    return res.status(401).json({ 
      error: "🔐 Invalid token.",
      code: 'INVALID_TOKEN'
    });
  }
};

// Role-based authorization middleware
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: "🚫 Access denied. Insufficient permissions.",
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }
    
    next();
  };
};

// Refresh token endpoint handler
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token required" });
    }
    
    // Verify refresh token
    const tokenData = verifyRefreshToken(refreshToken);
    
    // Get user
    const user = await User.findById(tokenData.userId).select("-password");
    
    if (!user || user.isBlocked) {
      refreshTokens.delete(refreshToken);
      return res.status(401).json({ error: "Invalid user" });
    }
    
    // Generate new tokens
    const newAccessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);
    
    // Remove old refresh token
    refreshTokens.delete(refreshToken);
    
    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(401).json({ error: error.message || "Invalid refresh token" });
  }
};

// Logout handler
export const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (token) {
      revokeToken(token);
    }
    
    // Also revoke refresh token if provided
    const { refreshToken } = req.body;
    if (refreshToken) {
      refreshTokens.delete(refreshToken);
    }
    
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
};

// Logout from all devices
export const logoutAll = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Revoke current access token
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      revokeToken(token);
    }
    
    // Revoke all refresh tokens for the user
    revokeAllUserTokens(req.user._id);
    
    res.json({ success: true, message: "Logged out from all devices" });
  } catch (error) {
    console.error("Logout all error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
};

// Export a clone of it named 'auth' so old files don't break!
export const auth = protect;

export default {
  protect,
  auth,
  authorize,
  refreshToken,
  logout,
  logoutAll,
  generateAccessToken,
  generateRefreshToken,
  revokeToken,
  revokeAllUserTokens,
};
