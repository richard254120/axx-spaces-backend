import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        error: "🔐 Access denied. No token provided." 
      });
    }

    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user (exclude sensitive fields)
    const user = await User.findById(decoded.id || decoded._id)
      .select("-password");

    if (!user) {
      return res.status(404).json({ 
        error: "👤 User no longer exists. Please login again." 
      });
    }

    // Attach user to request
    req.user = user;

    next();
  } catch (error) {
    console.error("❌ Auth middleware error:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ 
        error: "🔐 Session expired. Please login again." 
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ 
        error: "🔐 Invalid token." 
      });
    }

    return res.status(401).json({ 
      error: "🔐 Authentication failed." 
    });
  }
};