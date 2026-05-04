// middleware/auth.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        error: "No token provided. Please login." 
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: "User not found" 
      });
    }

    // Attach user to request
    req.user = user;
    req.token = token;

    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err.message);
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: "Token expired. Please login again." });
    }

    res.status(401).json({ 
      success: false,
      error: "Invalid token. Please login again." 
    });
  }
};