import express from "express";
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
import { uploadVerificationDocuments, processVerificationUploads } from "../middleware/verificationUpload.js";

const router = express.Router();

// User routes
router.post("/submit", auth, uploadVerificationDocuments, processVerificationUploads, submitVerification);
router.get("/status", auth, getVerificationStatus);
router.get("/history", auth, getVerificationHistory);
router.post("/resubmit/:id", auth, uploadVerificationDocuments, processVerificationUploads, resubmitVerification);

// Admin routes
router.get("/admin/pending", auth, adminOnly, getPendingVerifications);
router.get("/admin/:id", auth, adminOnly, getVerificationDetails);
router.put("/admin/:id/approve", auth, adminOnly, approveVerification);
router.put("/admin/:id/reject", auth, adminOnly, rejectVerification);

export default router;
