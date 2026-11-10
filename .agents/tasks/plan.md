# Implementation Plan: Agent QR Code Scan Tracking System

This plan implements a professional QR code scan tracking system that allows agents to monitor scans per day on their dashboard. The system will create individual scan records with detailed metadata (source, location, device info) and provide comprehensive analytics endpoints.

## Overview

The existing system has:
- A basic counter (`agentProfile.agentQrScans`) that increments on scan
- A simple POST `/:agentId/qr-scan` endpoint that updates the counter
- A GET `/qr-scans/me` endpoint that returns the total count

We will enhance this by:
1. Creating a new `AgentQRScan` model to store individual scan events with metadata
2. Adding analytics aggregation functions in a new controller
3. Updating the existing scan endpoint to create detailed records
4. Adding new analytics endpoints for daily breakdowns and dashboard summaries

## Implementation Steps

- [ ] 1. Create the AgentQRScan model at `/home/oguda/Desktop/AXX/backend/axx-spaces-backend/models/AgentQRScan.js`.
      This model stores individual QR scan events for agents with full metadata including source, location, device info, and timestamp. It follows the same pattern as the existing QRScan.js model (for properties) but is specific to agent profile scans. Include compound index `{ agent: 1, scannedAt: -1 }` for efficient date-range queries. Fields: `agent` (ObjectId ref User, required, indexed), `scannedAt` (Date, default Date.now, indexed), `source` (enum: poster/business_card/flyer/website/social_media/generic, default generic), `userAgent` (String), `ip` (String), `location: { lat, lng, city, country }`, `device: { type (enum mobile/tablet/desktop/unknown), os, browser }`. Enable timestamps.
      Files: `/home/oguda/Desktop/AXX/backend/axx-spaces-backend/models/AgentQRScan.js`
      Verify: Run `node -e "import('./models/AgentQRScan.js').then(m => console.log('Model loaded:', m.default.modelName))"` from the backend directory — should print "Model loaded: AgentQRScan" without errors.

- [ ] 2. Create the agent analytics controller at `/home/oguda/Desktop/AXX/backend/axx-spaces-backend/controllers/agentAnalyticsController.js`.
      Implement two main functions: `getAgentScanStats(req, res)` and `getAgentDashboardSummary(req, res)`. Both require authentication and only allow agents to query their own data (use req.user._id). `getAgentScanStats` accepts query params `startDate`, `endDate`, `period` (7d/30d/90d, default 30d) and returns comprehensive analytics: totalScans, dailyBreakdown array with date/scans/sources breakdown, sourceBreakdown object, locationBreakdown array (top cities), deviceBreakdown object (mobile/tablet/desktop counts), peakHours array (hour of day analysis), and trends object (weekOverWeek, monthOverMonth percentage changes). Use MongoDB aggregation pipelines for efficient queries. Normalize all dates to UTC for consistent daily grouping. Handle edge cases: missing date params (use period default), no scans yet (return empty arrays/zero counts), invalid date ranges (return 400 error). `getAgentDashboardSummary` returns combined metrics: QR scan totals (last7Days, last30Days, allTime), daily7DaySparkline array, totalPropertiesAssigned count, totalInquiries count (from Inquiry model where agent = user._id). Follow the pattern in analyticsController.js for response structure.
      Files: `/home/oguda/Desktop/AXX/backend/axx-spaces-backend/controllers/agentAnalyticsController.js`
      Verify: Run `node -e "import('./controllers/agentAnalyticsController.js').then(m => console.log('Exports:', Object.keys(m)))"` from the backend directory — should print "Exports: [ 'getAgentScanStats', 'getAgentDashboardSummary' ]" without errors.

- [ ] 3. Update the existing POST `/:agentId/qr-scan` endpoint in `/home/oguda/Desktop/AXX/backend/axx-spaces-backend/routes/agents.js`.
      The endpoint currently only increments the counter. Enhance it to ALSO create an AgentQRScan document with metadata extracted from the request. Accept optional request body fields: `source` (poster/business_card/flyer/website/social_media/generic), `location: { lat, lng, city, country }`, `device: { type, os, browser }`. Extract `userAgent` from `req.headers['user-agent']` and `ip` from `req.ip` or `req.headers['x-forwarded-for']`. Keep the existing `$inc` operation on `agentProfile.agentQrScans` for backward compatibility with any existing frontend code that reads this counter. Import AgentQRScan model at top of file. Endpoint remains public (no auth required) since it's called by QR code scanners. Handle case where agent doesn't exist (already handled, returns 404).
      Files: `/home/oguda/Desktop/AXX/backend/axx-spaces-backend/routes/agents.js`
      Verify: Start the dev server with `npm run dev`, then test the endpoint with `curl -X POST http://localhost:5000/api/agents/{validAgentId}/qr-scan -H "Content-Type: application/json" -d '{"source":"poster","location":{"city":"Nairobi","country":"Kenya"},"device":{"type":"mobile","os":"Android","browser":"Chrome"}}'` — should return success and increment both the counter and create a new AgentQRScan document. Query MongoDB to confirm: `mongosh axx_spaces_db --eval "db.agentqrscans.countDocuments()"` should show at least 1 document.

- [ ] 4. Add new analytics routes in `/home/oguda/Desktop/AXX/backend/axx-spaces-backend/routes/agents.js`.
      Add three new GET routes BEFORE the `/:agentId/*` wildcard routes to avoid route-order conflicts. The existing file has `/:agentId/qr-scan` at line 1016 which is already a wildcard match, so place new routes ABOVE that section. Routes: (1) `GET /qr-scans/stats` (auth required) → calls `agentAnalyticsController.getAgentScanStats`, (2) `GET /qr-scans/daily` (auth required) → convenience wrapper that calls getAgentScanStats with period=30d and returns only the dailyBreakdown field, (3) `GET /qr-scans/dashboard` (auth required) → calls `agentAnalyticsController.getAgentDashboardSummary`. Import the controller functions at the top: `import { getAgentScanStats, getAgentDashboardSummary } from "../controllers/agentAnalyticsController.js";`. All three routes use the existing `auth` middleware from `../middleware/auth.js` (already imported). For the `/qr-scans/daily` route, implement as thin wrapper: extract period=30d, call getAgentScanStats, respond with only req.data.dailyBreakdown.
      Files: `/home/oguda/Desktop/AXX/backend/axx-spaces-backend/routes/agents.js`
      Verify: Start the dev server with `npm run dev`. Test each new route with a valid agent JWT token: (1) `curl -H "Authorization: Bearer {validAgentToken}" http://localhost:5000/api/agents/qr-scans/stats?period=7d` — should return stats object with totalScans, dailyBreakdown, etc. (2) `curl -H "Authorization: Bearer {validAgentToken}" http://localhost:5000/api/agents/qr-scans/daily` — should return array of daily scan counts for last 30 days. (3) `curl -H "Authorization: Bearer {validAgentToken}" http://localhost:5000/api/agents/qr-scans/dashboard` — should return dashboard summary with scans, properties, and inquiries. Without auth token, all three should return 401 Unauthorized.

- [ ] 5. Update the admin analytics summary in `/home/oguda/Desktop/AXX/backend/axx-spaces-backend/controllers/analyticsController.js`.
      Import the AgentQRScan model at the top: `import AgentQRScan from "../models/AgentQRScan.js";`. In the `getSummary` function (currently handles landlord/mover/seller/tourism/business analytics), add a new conditional block for `userType === "agent"`. This block should calculate: (1) `totalAgentQrScans` — count of all AgentQRScan documents for this agent (use `req.user.id` or `req.user._id`), (2) `scansToday` — count where scannedAt is >= start of today (UTC), (3) `scansThisWeek` — count where scannedAt is >= start of this week (UTC), (4) `totalPropertiesAssigned` — count from Property model where assignedAgent equals agent ID and status is approved (follow the pattern from other userTypes). Return structure matching other userType responses: `{ views: totalAgentQrScans, inquiries: scansThisWeek, bookings: scansToday, revenue: 0, conversionRate: "0.0", propertiesAssigned: totalPropertiesAssigned, qrScansToday: scansToday, qrScansThisWeek: scansThisWeek, qrScansAllTime: totalAgentQrScans }`. Also add global QR scan metrics to the overall admin summary (if admin is querying): sum all AgentQRScan documents for totalAgentQrScans platform-wide, count today's scans, count this week's scans. Only add these if the existing getSummary function has an admin-specific response section.
      Files: `/home/oguda/Desktop/AXX/backend/axx-spaces-backend/controllers/analyticsController.js`
      Verify: Start the dev server with `npm run dev`. Test the agent summary endpoint with a valid agent JWT token: `curl -H "Authorization: Bearer {validAgentToken}" "http://localhost:5000/api/analytics/summary?userType=agent"` — should return JSON with qrScansToday, qrScansThisWeek, qrScansAllTime, and propertiesAssigned fields. Values should match the actual data in the database (can verify with manual MongoDB queries).

## Edge Cases & Special Handling

1. **Timezone Normalization**: All date calculations must use UTC to ensure consistent daily groupings across different server/client timezones. Use `new Date().setUTCHours(0,0,0,0)` for day boundaries.

2. **Missing Date Parameters**: When `startDate` or `endDate` is not provided, fall back to the `period` parameter (7d/30d/90d). If period is also missing, default to 30d.

3. **Unauthorized Access**: Every analytics endpoint must verify that `req.user._id` matches the queried agent. Agents can ONLY access their own scan data. Return 403 Forbidden if there's a mismatch.

4. **No Scans Yet**: When an agent has no scan records, return valid response structure with zero counts and empty arrays, not errors. Example: `{ totalScans: 0, dailyBreakdown: [], sourceBreakdown: {}, ... }`.

5. **Invalid Date Ranges**: If `startDate` is after `endDate`, return 400 Bad Request with clear error message.

6. **Route Order Conflicts**: The new routes `/qr-scans/stats`, `/qr-scans/daily`, `/qr-scans/dashboard` must be placed BEFORE the `/:agentId/qr-scan` route in agents.js to avoid the `:agentId` param matching "qr-scans".

7. **Backward Compatibility**: The existing `agentProfile.agentQrScans` counter field must continue to be incremented alongside creating the new AgentQRScan documents, since existing frontend code may depend on it.

8. **Device Detection**: The `device.type` field should be inferred from the userAgent string if not explicitly provided. Simple heuristic: if userAgent contains "Mobile", set type to "mobile"; if contains "Tablet", set to "tablet"; otherwise "desktop". If userAgent is missing, default to "unknown".

9. **IP Address Extraction**: Try `req.ip` first, then fall back to `req.headers['x-forwarded-for']?.split(',')[0]` for proxied requests. If both are unavailable, store empty string.

10. **MongoDB Aggregation Performance**: The compound index `{ agent: 1, scannedAt: -1 }` is critical for query performance. Ensure it's created in the model schema.

## Verification Commands

After implementing all steps, verify the complete system:

```bash
# 1. Start the development server
npm run dev

# 2. Verify models load without errors
node -e "import('./models/AgentQRScan.js').then(m => console.log('AgentQRScan:', m.default.modelName))"

# 3. Verify controller exports
node -e "import('./controllers/agentAnalyticsController.js').then(m => console.log('Controller exports:', Object.keys(m)))"

# 4. Test the scan recording endpoint (replace {agentId} with actual agent ID)
curl -X POST http://localhost:5000/api/agents/{agentId}/qr-scan \
  -H "Content-Type: application/json" \
  -d '{"source":"poster","location":{"city":"Nairobi","country":"Kenya"},"device":{"type":"mobile","os":"Android","browser":"Chrome"}}'

# 5. Check that scan was recorded in MongoDB
mongosh axx_spaces_db --eval "db.agentqrscans.find().limit(1).pretty()"

# 6. Test analytics endpoints (replace {token} with valid agent JWT)
curl -H "Authorization: Bearer {token}" http://localhost:5000/api/agents/qr-scans/stats?period=7d
curl -H "Authorization: Bearer {token}" http://localhost:5000/api/agents/qr-scans/daily
curl -H "Authorization: Bearer {token}" http://localhost:5000/api/agents/qr-scans/dashboard

# 7. Test admin analytics summary (replace {token} with valid agent JWT)
curl -H "Authorization: Bearer {token}" "http://localhost:5000/api/analytics/summary?userType=agent"

# 8. Verify unauthorized access is blocked (no token)
curl http://localhost:5000/api/agents/qr-scans/stats
# Should return: {"error": " Access denied. No token provided."}
```

## Files to Create or Modify

### New Files
1. `/home/oguda/Desktop/AXX/backend/axx-spaces-backend/models/AgentQRScan.js` — New model for agent QR scan events
2. `/home/oguda/Desktop/AXX/backend/axx-spaces-backend/controllers/agentAnalyticsController.js` — New controller with analytics functions

### Modified Files
1. `/home/oguda/Desktop/AXX/backend/axx-spaces-backend/routes/agents.js` — Update existing POST endpoint, add 3 new GET routes, add import
2. `/home/oguda/Desktop/AXX/backend/axx-spaces-backend/controllers/analyticsController.js` — Add agent userType handling and import AgentQRScan model

## Implementation Notes

- Follow the existing code style and patterns from QRScan.js and analyticsController.js
- Use ES6 module syntax (`import`/`export`) throughout
- All async operations use async/await (no raw Promises or callbacks)
- Error responses follow the existing format: `{ error: "message" }` or `{ success: false, message: "..." }`
- Success responses follow: `{ success: true, data: {...} }`
- Authentication uses the existing middleware from `middleware/auth.js`
- MongoDB queries use Mongoose models with aggregation pipelines for complex analytics
- Dates are stored as Date objects, not strings
- Enums are enforced at the schema level
- All user-facing text uses professional tone without emojis or informal language (note: some existing code has emojis in console.log, that's okay for debugging)
