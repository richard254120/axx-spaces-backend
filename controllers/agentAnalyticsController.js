import AgentQRScan from "../models/AgentQRScan.js";
import Property from "../models/Property.js";
import Inquiry from "../models/Inquiry.js";

// Helper function to parse date range from query params
const parseDateRange = (startDate, endDate, period = "30d") => {
  const now = new Date();
  let start, end;

  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error("Invalid date format. Use ISO 8601 format (YYYY-MM-DD)");
    }
    
    if (start > end) {
      throw new Error("startDate must be before or equal to endDate");
    }
  } else {
    // Use period
    end = new Date(now.setUTCHours(23, 59, 59, 999));
    
    switch (period) {
      case "7d":
        start = new Date(now.setDate(now.getDate() - 6));
        break;
      case "90d":
        start = new Date(now.setDate(now.getDate() - 89));
        break;
      case "30d":
      default:
        start = new Date(now.setDate(now.getDate() - 29));
        break;
    }
    start.setUTCHours(0, 0, 0, 0);
  }

  return { start, end };
};

// Helper to get UTC date string (YYYY-MM-DD)
const getUTCDateString = (date) => {
  return date.toISOString().split("T")[0];
};

// @desc    Get detailed scan statistics for an agent
// @route   GET /api/agents/qr-scans/stats
// @access  Private (agent only, own data)
export const getAgentScanStats = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const agentId = req.user._id;
    const { startDate, endDate, period = "30d" } = req.query;

    // Parse date range
    let start, end;
    try {
      ({ start, end } = parseDateRange(startDate, endDate, period));
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    // Aggregate scan data
    const scans = await AgentQRScan.find({
      agent: agentId,
      scannedAt: { $gte: start, $lte: end },
    }).sort({ scannedAt: 1 });

    const totalScans = scans.length;

    // Daily breakdown
    const dailyMap = {};
    scans.forEach((scan) => {
      const dateStr = getUTCDateString(scan.scannedAt);
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { date: dateStr, scans: 0, sources: {} };
      }
      dailyMap[dateStr].scans += 1;
      dailyMap[dateStr].sources[scan.source] = (dailyMap[dateStr].sources[scan.source] || 0) + 1;
    });
    const dailyBreakdown = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    // Source breakdown
    const sourceBreakdown = {};
    scans.forEach((scan) => {
      sourceBreakdown[scan.source] = (sourceBreakdown[scan.source] || 0) + 1;
    });

    // Device breakdown
    const deviceBreakdown = {};
    scans.forEach((scan) => {
      const deviceType = scan.device?.type || "unknown";
      deviceBreakdown[deviceType] = (deviceBreakdown[deviceType] || 0) + 1;
    });

    // Location breakdown (top 10 cities)
    const locationMap = {};
    scans.forEach((scan) => {
      if (scan.location?.city) {
        const key = `${scan.location.city}, ${scan.location.country || ""}`.trim();
        locationMap[key] = (locationMap[key] || 0) + 1;
      }
    });
    const locationBreakdown = Object.entries(locationMap)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Peak hours (UTC hour of day)
    const peakHours = Array(24).fill(0);
    scans.forEach((scan) => {
      const hour = scan.scannedAt.getUTCHours();
      peakHours[hour] += 1;
    });

    // Trends: compare with previous period
    const periodDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - periodDays);
    const prevEnd = new Date(start);
    prevEnd.setSeconds(prevEnd.getSeconds() - 1);

    const prevScans = await AgentQRScan.countDocuments({
      agent: agentId,
      scannedAt: { $gte: prevStart, $lte: prevEnd },
    });

    let changePercent = 0;
    if (prevScans > 0) {
      changePercent = (((totalScans - prevScans) / prevScans) * 100).toFixed(1);
    } else if (totalScans > 0) {
      changePercent = 100;
    }

    const trends = {};
    if (period === "7d") {
      trends.weekOverWeek = parseFloat(changePercent);
    } else if (period === "30d") {
      trends.monthOverMonth = parseFloat(changePercent);
    } else {
      trends.periodOverPeriod = parseFloat(changePercent);
    }

    res.json({
      success: true,
      data: {
        agentId,
        period,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        totalScans,
        dailyBreakdown,
        sourceBreakdown,
        deviceBreakdown,
        locationBreakdown,
        peakHours,
        trends,
      },
    });
  } catch (error) {
    console.error("Get agent scan stats error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch scan statistics" });
  }
};

// @desc    Get agent dashboard summary with combined metrics
// @route   GET /api/agents/qr-scans/dashboard
// @access  Private (agent only, own data)
export const getAgentDashboardSummary = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const agentId = req.user._id;
    const now = new Date();

    // Calculate date boundaries (UTC)
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    const last7DaysStart = new Date(now);
    last7DaysStart.setDate(last7DaysStart.getDate() - 7);
    last7DaysStart.setUTCHours(0, 0, 0, 0);

    const last30DaysStart = new Date(now);
    last30DaysStart.setDate(last30DaysStart.getDate() - 30);
    last30DaysStart.setUTCHours(0, 0, 0, 0);

    // Run queries in parallel
    const [allTimeScans, last7dScans, last30dScans, todayScans, sparklineData, totalProperties, totalInquiries] = await Promise.all([
      AgentQRScan.countDocuments({ agent: agentId }),
      AgentQRScan.countDocuments({ agent: agentId, scannedAt: { $gte: last7DaysStart } }),
      AgentQRScan.countDocuments({ agent: agentId, scannedAt: { $gte: last30DaysStart } }),
      AgentQRScan.countDocuments({ agent: agentId, scannedAt: { $gte: todayStart } }),
      // Sparkline: daily counts for last 7 days
      AgentQRScan.aggregate([
        {
          $match: {
            agent: agentId,
            scannedAt: { $gte: last7DaysStart },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$scannedAt" },
            },
            scans: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Total properties assigned to this agent
      Property.countDocuments({ assignedAgent: agentId, status: "approved" }),
      // Total inquiries for this agent (soft-fail if model doesn't exist)
      Inquiry.countDocuments({ agent: agentId }).catch(() => 0),
    ]);

    // Fill sparkline with all 7 days (including days with 0 scans)
    const sparkline7d = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = getUTCDateString(date);
      const dayData = sparklineData.find((d) => d._id === dateStr);
      sparkline7d.push({
        date: dateStr,
        scans: dayData ? dayData.scans : 0,
      });
    }

    res.json({
      success: true,
      data: {
        agentId,
        qrScans: {
          allTime: allTimeScans,
          last7d: last7dScans,
          last30d: last30dScans,
          today: todayScans,
          sparkline7d,
        },
        properties: {
          total: totalProperties,
        },
        inquiries: {
          total: totalInquiries,
        },
      },
    });
  } catch (error) {
    console.error("Get agent dashboard summary error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch dashboard summary" });
  }
};
