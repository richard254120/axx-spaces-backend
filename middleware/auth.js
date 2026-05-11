import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "🔐 Access denied. No token provided." });
    }

    // 1. Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ FIX: Use decoded.userId (not decoded.id) because JWT is created with userId
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(404).json({ error: "👤 User no longer exists." });
    }

    // 3. Attach the full user object to the request
    req.user = user;
    req.userId = decoded.userId;  // Also attach userId for compatibility
    
    next();
  } catch (error) {
    console.error("❌ Auth error:", error.message);
    
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "🔐 Session expired. Please login again." });
    }
    
    return res.status(401).json({ error: "🔐 Invalid token." });
  }
};