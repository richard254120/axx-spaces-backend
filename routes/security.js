// security.js - Security Monitoring and Management Routes
import express from "express";
import { protect, authorize } from "../middleware/enhancedAuth.js";
import security from "../middleware/enhancedSecurity.js";

const router = express.Router();

// ====================== GET SECURITY STATUS ======================
// Admin only - Get current security status
router.get("/status", protect, authorize("admin"), (req, res) => {
  const status = {
    timestamp: new Date().toISOString(),
    securityFeatures: {
      helmet: true,
      cors: true,
      rateLimiting: true,
      ipBlocking: true,
      inputValidation: true,
      csrfProtection: true,
      xssProtection: true,
      sqlInjectionPrevention: true,
      mongoSanitization: true,
      securityLogging: true,
      accountLockout: true,
      passwordValidation: true,
      fileUploadSecurity: true,
    },
    blockedIPs: security.securityStore.blockedIPs.size,
    failedAttempts: security.securityStore.failedAttempts.size,
    suspiciousActivity: security.securityStore.suspiciousActivity.size,
  };

  res.json(status);
});

// ====================== GET BLOCKED IPs ======================
// Admin only - Get list of blocked IPs
router.get("/blocked-ips", protect, authorize("admin"), (req, res) => {
  const blockedIPs = Array.from(security.securityStore.blockedIPs.entries()).map(([ip, timestamp]) => ({
    ip,
    blockedAt: new Date(timestamp).toISOString(),
    timeRemaining: Math.max(0, Math.ceil((timestamp + 60 * 60 * 1000 - Date.now()) / 1000 / 60)),
  }));

  res.json({ blockedIPs, count: blockedIPs.length });
});

// ====================== UNBLOCK IP ======================
// Admin only - Unblock an IP
router.delete("/blocked-ips/:ip", protect, authorize("admin"), (req, res) => {
  const { ip } = req.params;

  if (security.securityStore.blockedIPs.has(ip)) {
    security.securityStore.blockedIPs.delete(ip);
    console.log(`🔓 IP Unblocked: ${ip}`);
    res.json({ success: true, message: `IP ${ip} unblocked successfully` });
  } else {
    res.status(404).json({ error: "IP not found in blocked list" });
  }
});

// ====================== GET SECURITY LOGS ======================
// Admin only - Get recent security events
router.get("/logs", protect, authorize("admin"), (req, res) => {
  const { limit = 50 } = req.query;

  const logs = {
    blockedIPs: Array.from(security.securityStore.blockedIPs.entries()).slice(0, limit),
    failedAttempts: Array.from(security.securityStore.failedAttempts.entries()).slice(0, limit),
    suspiciousActivity: Array.from(security.securityStore.suspiciousActivity.entries()).slice(0, limit),
  };

  res.json(logs);
});

// ====================== CLEAR SECURITY LOGS ======================
// Admin only - Clear old security logs
router.delete("/logs", protect, authorize("admin"), (req, res) => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  let clearedCount = 0;

  // Clear old blocked IPs
  security.securityStore.blockedIPs.forEach((timestamp, ip) => {
    if (now - timestamp > oneHour) {
      security.securityStore.blockedIPs.delete(ip);
      clearedCount++;
    }
  });

  // Clear old failed attempts
  security.securityStore.failedAttempts.forEach((data, key) => {
    if (now - data.timestamp > oneHour) {
      security.securityStore.failedAttempts.delete(key);
      clearedCount++;
    }
  });

  // Clear old suspicious activity
  security.securityStore.suspiciousActivity.forEach((data, key) => {
    if (now - data.timestamp > oneHour) {
      security.securityStore.suspiciousActivity.delete(key);
      clearedCount++;
    }
  });

  res.json({ success: true, message: `Cleared ${clearedCount} old security entries` });
});

// ====================== CSP REPORT ENDPOINT ======================
// Receive Content Security Policy violation reports
router.post("/csp-report", (req, res) => {
  const report = req.body;

  console.log("🚨 CSP Violation Report:", JSON.stringify(report, null, 2));

  // In production, you would log this to a database or monitoring service
  // For now, we just log it to the console

  res.status(204).end();
});

// ====================== SECURITY HEALTH CHECK ======================
// Public endpoint - Check if security features are active
router.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    security: "active",
    timestamp: new Date().toISOString(),
  });
});

export default router;
