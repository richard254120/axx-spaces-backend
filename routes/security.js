// routes/security.js — Security Monitoring & Management (admin-only)
import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import security from "../middleware/enhancedSecurity.js";

const router = express.Router();

// ── CSP violation report (PUBLIC — browsers POST here automatically)
router.post("/csp-report", express.json({ type: "application/csp-report" }), (req, res) => {
  const report = req.body?.["csp-report"] || req.body;
  if (report) {
    security.securityLogger.warn("[CSP] Violation report received", {
      blockedURI: report["blocked-uri"],
      violatedDirective: report["violated-directive"],
      documentURI: report["document-uri"],
      ip: security.getClientIP(req),
    });
  }
  res.status(204).end();
});

// ── Security health (PUBLIC — monitoring services ping this)
router.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    security: "active",
    timestamp: new Date().toISOString(),
  });
});

// ── All routes below require admin auth ──────────────────────────

// GET /api/security/status — full security dashboard snapshot
router.get("/status", protect, authorize("admin"), (req, res) => {
  const store = security.securityStore;
  res.json({
    timestamp: new Date().toISOString(),
    securityLayers: {
      requestIds: true,
      helmetCSP: true,
      strictCORS: true,
      httpsEnforcement: process.env.NODE_ENV === "production",
      ipBlocking: true,
      pathTraversalGuard: true,
      userAgentFilter: true,
      rateLimiting: true,
      nosqlSanitization: true,
      xssProtection: true,
      hppPrevention: true,
      deepInputValidation: true,
      csrfProtection: true,
      responseSanitizer: true,
      auditLogger: true,
      bcryptHashing: true,
      jwtAuth: true,
      roleBasedAccessControl: true,
    },
    stats: {
      blockedIPs: store.blockedIPs.size,
      failedAttempts: store.failedAttempts.size,
      suspiciousActivities: store.suspiciousActivity.size,
      csrfTokens: store.csrfTokens.size,
    },
  });
});

// GET /api/security/blocked-ips — list all currently blocked IPs
router.get("/blocked-ips", protect, authorize("admin"), (req, res) => {
  const now = Date.now();
  const list = Array.from(security.securityStore.blockedIPs.entries()).map(([ip, data]) => ({
    ip,
    reason: data.reason,
    blockedAt: new Date(data.blockedAt).toISOString(),
    unblockAt: new Date(data.unblockAt).toISOString(),
    minutesRemaining: Math.max(0, Math.ceil((data.unblockAt - now) / 60000)),
  }));
  res.json({ blockedIPs: list, count: list.length });
});

// DELETE /api/security/blocked-ips/:ip — manually unblock an IP
router.delete("/blocked-ips/:ip", protect, authorize("admin"), (req, res) => {
  const ip = decodeURIComponent(req.params.ip);
  if (!security.securityStore.blockedIPs.has(ip)) {
    return res.status(404).json({ error: "IP not found in blocked list." });
  }
  security.securityStore.blockedIPs.delete(ip);
  security.securityLogger.info("[ADMIN] IP manually unblocked", {
    unblockedIP: ip,
    adminId: req.user._id,
  });
  res.json({ success: true, message: `IP ${ip} has been unblocked.` });
});

// POST /api/security/block-ip — manually block an IP
router.post("/block-ip", protect, authorize("admin"), (req, res) => {
  const { ip, reason = "manual block by admin", durationMinutes = 60 } = req.body;
  if (!ip) return res.status(400).json({ error: "IP address is required." });

  security.blockIP(ip, reason, durationMinutes * 60 * 1000);
  security.securityLogger.warn("[ADMIN] IP manually blocked", {
    blockedIP: ip,
    reason,
    durationMinutes,
    adminId: req.user._id,
  });
  res.json({ success: true, message: `IP ${ip} blocked for ${durationMinutes} minutes.` });
});

// GET /api/security/suspicious — list suspicious activity entries
router.get("/suspicious", protect, authorize("admin"), (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || "100", 10), 500);
  const list = Array.from(security.securityStore.suspiciousActivity.entries())
    .sort((a, b) => b[1].lastAt - a[1].lastAt)
    .slice(0, limit)
    .map(([key, data]) => ({
      key,
      count: data.count,
      firstAt: new Date(data.firstAt).toISOString(),
      lastAt: new Date(data.lastAt).toISOString(),
    }));
  res.json({ suspiciousActivity: list, count: list.length });
});

// GET /api/security/failed-attempts — list failed auth attempts
router.get("/failed-attempts", protect, authorize("admin"), (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || "100", 10), 500);
  const list = Array.from(security.securityStore.failedAttempts.entries())
    .sort((a, b) => b[1].lastAt - a[1].lastAt)
    .slice(0, limit)
    .map(([key, data]) => ({
      key,
      count: data.count,
      firstAt: new Date(data.firstAt).toISOString(),
      lastAt: new Date(data.lastAt).toISOString(),
    }));
  res.json({ failedAttempts: list, count: list.length });
});

// DELETE /api/security/clear — clear expired security entries (housekeeping)
router.delete("/clear", protect, authorize("admin"), (req, res) => {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  let cleared = 0;

  security.securityStore.blockedIPs.forEach((data, ip) => {
    if (now > data.unblockAt) { security.securityStore.blockedIPs.delete(ip); cleared++; }
  });
  security.securityStore.failedAttempts.forEach((data, key) => {
    if (now - data.lastAt > ONE_HOUR) { security.securityStore.failedAttempts.delete(key); cleared++; }
  });
  security.securityStore.suspiciousActivity.forEach((data, key) => {
    if (now - data.lastAt > ONE_HOUR) { security.securityStore.suspiciousActivity.delete(key); cleared++; }
  });

  security.securityLogger.info("[ADMIN] Security store cleaned", { cleared, adminId: req.user._id });
  res.json({ success: true, cleared, message: `Cleared ${cleared} expired security entries.` });
});

export default router;
