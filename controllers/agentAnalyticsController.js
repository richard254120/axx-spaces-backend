import AgentQRScan from "../models/AgentQRScan.js";
import Property from "../models/Property.js";
import Inquiry from "../models/Inquiry.js";
import mongoose from "mongoose";

// @desc    Get comprehensive QR scan statistics for agent
// @route   GET /api/agents/qr-scans/stats
// @access  Private (Agent only)
export const getAgentScanStats = async (req, res) => {
  try {
    const agentId = req.user._id || req.user.id;
    const { startDate, endDate, period = "30d" } = req.query;

    // Calculate date range
    let start, end;
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      if (start > end) {
        return res.status(400).json({ error: "startDate must be before endDate" });
      }
    } else {
      // Use period
      end = new Date();
      end.setUTCHours(23, 59, 59, 999);
      start = new Date();
      
      const periodMap = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
      };
      const days = periodMap[period] || 30;
      start.setDate(start.getDate() - days);
      start.setUTCHours(0, 0, 0, 0);
    }

    // Total scans in period
    const totalScans = await AgentQRScan.countDocuments({
      agent: agentId,
      scannedAt: { $gte: start, $lte: end },
    });

    // Daily breakdown
    const dailyBreakdown = await AgentQRScan.aggregate([
      {
        $match: {
          agent: new mongoose.Types.ObjectId(agentId),
          scannedAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: "%Y-%m-%d", date: "$scannedAt" },
            },
          },
          scans: { $sum: 1 },
          sources: {
            $push: "$source",
          },
        },
      },
      {
        $project: {
          _id: 0,
          date: "$_id.date",
          scans: 1,
          sources: {
            $arrayToObject: {
              $map: {
                input: { $setUnion: "$sources" },
                as: "source",
                in: {
                  k: "$$source",
                  v: {
                    $size: {
                      $filter: {
                        input: "$sources",
                        cond: { $eq: ["$$this", "$$source"] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      { $sort: { date: -1 } },
    ]);

    // Source breakdown
    const sourceBreakdown = await AgentQRScan.aggregate([
      {
        $match: {
          agent: new mongoose.Types.ObjectId(agentId),
          scannedAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$source",
          count: { $sum: 1 },
        },
      },
    ]);

    const sourceBreakdownObj = {};
    sourceBreakdown.forEach((s) => {
      sourceBreakdownObj[s._id] = s.count;
    });

    // Location breakdown (top cities)
    const locationBreakdown = await AgentQRScan.aggregate([
      {
        $match: {
          agent: new mongoose.Types.ObjectId(agentId),
          scannedAt: { $gte: start, $lte: end },
          "location.city": { $exists: true, $ne: "" },
        },
      },
      {
        $group: {
          _id: {
            city: "$location.city",
            country: "$location.country",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          city: "$_id.city",
          country: "$_id.country",
          count: 1,
        },
      },
    ]);

    // Device breakdown
    const deviceBreakdown = await AgentQRScan.aggregate([
      {
        $match: {
          agent: new mongoose.Types.ObjectId(agentId),
          scannedAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$device.type",
          count: { $sum: 1 },
        },
      },
    ]);

    const deviceBreakdownObj = {};
    deviceBreakdown.forEach((d) => {
      deviceBreakdownObj[d._id] = d.count;
    });

    // Peak hours (hour of day analysis)
    const peakHours = await AgentQRScan.aggregate([
      {
        $match: {
          agent: new mongoose.Types.ObjectId(agentId),
          scannedAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { $hour: "$scannedAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          hour: "$_id",
          count: 1,
        },
      },
    ]);

    // Calculate trends (week-over-week, month-over-month)
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const thisWeekScans = await AgentQRScan.countDocuments({
      agent: agentId,
      scannedAt: { $gte: weekAgo, $lte: now },
    });

    const lastWeekScans = await AgentQRScan.countDocuments({
      agent: agentId,
      scannedAt: { $gte: twoWeeksAgo, $lt: weekAgo },
    });

    const thisMonthScans = await AgentQRScan.countDocuments({
      agent: agentId,
      scannedAt: { $gte: monthAgo, $lte: now },
    });

    const lastMonthScans = await AgentQRScan.countDocuments({
      agent: agentId,
      scannedAt: { $gte: twoMonthsAgo, $lt: monthAgo },
    });

    const weekOverWeek =
      lastWeekScans > 0
        ? (((thisWeekScans - lastWeekScans) / lastWeekScans) * 100).toFixed(1)
        : thisWeekScans > 0
        ? "+100"
        : "0";

    const monthOverMonth =
      lastMonthScans > 0
        ? (((thisMonthScans - lastMonthScans) / lastMonthScans) * 100).toFixed(1)
        : thisMonthScans > 0
        ? "+100"
        : "0";

    res.json({
      success: true,
      data: {
        totalScans,
        period: period || `${startDate} to ${endDate}`,
        dateRange: {
          start: start.toISOString().split("T")[0],
          end: end.toISOString().split("T")[0],
        },
        dailyBreakdown,
        sourceBreakdown: sourceBreakdownObj,
        locationBreakdown,
        deviceBreakdown: deviceBreakdownObj,
        peakHours,
        trends: {
          weekOverWeek: weekOverWeek >= 0 ? `+${weekOverWeek}%` : `${weekOverWeek}%`,
          monthOverMonth: monthOverMonth >= 0 ? `+${monthOverMonth}%` : `${monthOverMonth}%`,
        },
      },
    });
  } catch (error) {
    console.error("Get agent scan stats error:", error);
    res.status(500).json({ error: "Failed to fetch QR scan statistics" });
  }
};

// @desc    Get agent dashboard summary with all metrics
// @route   GET /api/agents/qr-scans/dashboard
// @access  Private (Agent only)
export const getAgentDashboardSummary = async (req, res) => {
  try {
    const agentId = req.user._id || req.user.id;

    // QR scan metrics
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const scansLast7Days = await AgentQRScan.countDocuments({
      agent: agentId,
      scannedAt: { $gte: sevenDaysAgo },
    });

    const scansLast30Days = await AgentQRScan.countDocuments({
      agent: agentId,
      scannedAt: { $gte: thirtyDaysAgo },
    });

    const scansAllTime = await AgentQRScan.countDocuments({
      agent: agentId,
    });

    // Daily 7-day sparkline
    const daily7DaySparkline = await AgentQRScan.aggregate([
      {
        $match: {
          agent: new mongoose.Types.ObjectId(agentId),
          scannedAt: { $gte: sevenDaysAgo },
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
      {
        $project: {
          _id: 0,
          date: "$_id",
          scans: 1,
        },
      },
    ]);

    // Properties assigned to agent
    const totalPropertiesAssigned = await Property.countDocuments({
      assignedAgent: agentId,
      status: "approved",
    });

    // Total inquiries (if Inquiry model tracks agent)
    let totalInquiries = 0;
    try {
      totalInquiries = await Inquiry.countDocuments({
        agent: agentId,
      });
    } catch (err) {
      // Inquiry model might not have agent field, that's okay
      console.log("Note: Inquiry model does not track agent field");
    }

    res.json({
      success: true,
      data: {
        qrScans: {
          last7Days: scansLast7Days,
          last30Days: scansLast30Days,
          allTime: scansAllTime,
        },
        daily7DaySparkline,
        totalPropertiesAssigned,
        totalInquiries,
      },
    });
  } catch (error) {
    console.error("Get agent dashboard summary error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
};
