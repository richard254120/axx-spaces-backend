import jwt from "jsonwebtoken";
import User from "../models/User.js";

// 1. Define and export protect
export const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "🔐 Access denied. No token provided." });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Use decoded.userId because JWT is created with userId
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(404).json({ error: "👤 User no longer exists." });
    }

    // Attach the full user object to the request
    req.user = user;
    req.userId = decoded.userId;  // Attach userId for compatibility
    
    next();
  } catch (error) {
    console.error("❌ Auth error:", error.message);
    
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "🔐 Session expired. Please login again." });
    }
    
    return res.status(401).json({ error: "🔐 Invalid token." });
  }
};

// 2. Export a clone of it named 'auth' so old files don't break!
export const auth = protect;

// 3. Admin-only middleware
export const adminOnly = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "❌ Access denied. Admin only." });
    }
    next();
  } catch (error) {
    console.error("❌ Admin auth error:", error.message);
    return res.status(500).json({ error: "❌ Server error" });
  }
};