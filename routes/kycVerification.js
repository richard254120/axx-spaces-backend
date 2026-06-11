import express from "express";
import multer from "multer";
import {
  submitVerification,
  getVerificationStatus,
  getVerificationHistory,
  getPendingVerifications,
  approveVerification,
  rejectVerification,
  getVerificationDetails,
  resubmitVerification,
} from "../controllers/verificationController.js";
import { auth, adminOnly } from "../middleware/auth.js";
import uploadVerificationDocuments, { processVerificationUploads } from "../middleware/verificationUpload.js";

const router = express.Router();

// User routes
router.post("/submit", auth, (req, res, next) => {
  uploadVerificationDocuments(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Multer error (file size, file type, etc.)
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File size exceeds 15MB limit' });
      }
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      // Other errors
      return res.status(400).json({ success: false, message: err.message });
    }
    // No error, continue to next middleware
    next();
  });
}, processVerificationUploads, submitVerification);
router.get("/status", auth, getVerificationStatus);
router.get("/history", auth, getVerificationHistory);
router.post("/resubmit/:id", auth, (req, res, next) => {
  uploadVerificationDocuments(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File size exceeds 15MB limit' });
      }
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
}, processVerificationUploads, resubmitVerification);

// Admin routes
router.get("/admin/pending", auth, adminOnly, getPendingVerifications);
router.get("/admin/:id", auth, adminOnly, getVerificationDetails);
router.put("/admin/:id/approve", auth, adminOnly, approveVerification);
router.put("/admin/:id/reject", auth, adminOnly, rejectVerification);

export default router;
