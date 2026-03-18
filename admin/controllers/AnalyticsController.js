const { DynamoDBService } = require("../../shared/utils/DynamoDB");
const { TABLES, TICKET_STATUSES } = require("../../shared/config/Constants");
const { APIError, asyncHandler } = require("../../shared/middleware/ErrorHandler");

/**
 * Analytics Controller
 */
const AnalyticsController = {
  /**
   * Get dashboard analytics
   */
  getDashboardAnalytics: asyncHandler(async (req, res) => {
    const { organisationId } = req.user;

    if (!organisationId) {
      throw new APIError("User is not part of an organisation", "NO_ORG", 400);
    }

    // Get tickets
    const ticketsResult = await DynamoDBService.scan(TABLES.TICKETS, {
      filterExpression: "orgId = :orgId",
      expressionAttributeValues: { ":orgId": organisationId },
    });
    const tickets = ticketsResult.items;

    const meetingsResult = await DynamoDBService.scan(TABLES.MEETINGS, {
      filterExpression: "orgId = :orgId",
      expressionAttributeValues: { ":orgId": organisationId },
    });
    const meetings = meetingsResult.items;

    const usersResult = await DynamoDBService.scan(TABLES.USERS, {
      filterExpression: "organisationId = :orgId",
      expressionAttributeValues: { ":orgId": organisationId },
    });
    const members = usersResult.items;

    // Calculate metrics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentTickets = tickets.filter((t) => new Date(t.createdAt) >= thirtyDaysAgo);
    const recentMeetings = meetings.filter((m) => new Date(m.createdAt) >= sevenDaysAgo);

    const analytics = {
      overview: {
        totalTickets: tickets.length,
        totalMeetings: meetings.length,
        totalMembers: members.length,
        activeTickets: tickets.filter((t) => t.status !== TICKET_STATUSES.DONE).length,
        completedTickets: tickets.filter((t) => t.status === TICKET_STATUSES.DONE).length,
        overdueTickets: tickets.filter(
          (t) =>
            t.deadline &&
            new Date(t.deadline) < now &&
            t.status !== TICKET_STATUSES.DONE
        ).length,
      },
      ticketsByStatus: {
        BACKLOG: tickets.filter((t) => t.status === TICKET_STATUSES.BACKLOG).length,
        ACTIVE: tickets.filter((t) => t.status === TICKET_STATUSES.ACTIVE).length,
        IN_PROGRESS: tickets.filter((t) => t.status === TICKET_STATUSES.IN_PROGRESS).length,
        IN_REVIEW: tickets.filter((t) => t.status === TICKET_STATUSES.IN_REVIEW).length,
        DONE: tickets.filter((t) => t.status === TICKET_STATUSES.DONE).length,
      },
      ticketsByPriority: {
        LOW: tickets.filter((t) => t.priority === "LOW").length,
        MEDIUM: tickets.filter((t) => t.priority === "MEDIUM").length,
        HIGH: tickets.filter((t) => t.priority === "HIGH").length,
        CRITICAL: tickets.filter((t) => t.priority === "CRITICAL").length,
      },
      recentActivity: {
        ticketsThisMonth: recentTickets.length,
        meetingsThisWeek: recentMeetings.length,
      },
      productivity: {
        averageCompletionTime: calculateAverageCompletionTime(tickets),
        ticketsPerMember: members.map((m) => ({
          userId: m.userId,
          name: m.name,
          ticketCount: tickets.filter((t) => t.assigneeId === m.userId).length,
        })),
      },
    };

    res.success(analytics);
  }),

  /**
   * Get detailed analytics
   */
  getDetailedAnalytics: asyncHandler(async (req, res) => {
    const { organisationId } = req.user;
    const { startDate, endDate } = req.query;

    if (!organisationId) {
      throw new APIError("User is not part of an organisation", "NO_ORG", 400);
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const ticketsResult = await DynamoDBService.scan(TABLES.TICKETS, {
      filterExpression: "orgId = :orgId AND createdAt BETWEEN :start AND :end",
      expressionAttributeValues: {
        ":orgId": organisationId,
        ":start": start.toISOString(),
        ":end": end.toISOString(),
      },
    });
    const tickets = ticketsResult.items;

    // Generate daily stats
    const dailyStats = generateDailyStats(tickets, start, end);

    const analytics = {
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      summary: {
        totalTickets: tickets.length,
        completedTickets: tickets.filter((t) => t.status === TICKET_STATUSES.DONE).length,
        averageCompletionTime: calculateAverageCompletionTime(tickets),
      },
      dailyStats,
      sourceBreakdown: {
        MANUAL: tickets.filter((t) => t.sourceType === "MANUAL").length,
        MEETING: tickets.filter((t) => t.sourceType === "MEETING").length,
        SLACK: tickets.filter((t) => t.sourceType === "SLACK").length,
        CHROME_EXTENSION: tickets.filter((t) => t.sourceType === "CHROME_EXTENSION").length,
      },
    };

    res.success(analytics);
  }),

  /**
   * Get ticket trends
   */
  getTicketTrends: asyncHandler(async (req, res) => {
    const { organisationId } = req.user;
    const { days = 30 } = req.query;

    if (!organisationId) {
      throw new APIError("User is not part of an organisation", "NO_ORG", 400);
    }

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const ticketsResult = await DynamoDBService.scan(TABLES.TICKETS, {
      filterExpression: "orgId = :orgId AND createdAt >= :startDate",
      expressionAttributeValues: {
        ":orgId": organisationId,
        ":startDate": startDate.toISOString(),
      },
    });
    const tickets = ticketsResult.items;

    // Group by date
    const trends = {};
    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      trends[dateStr] = {
        created: 0,
        completed: 0,
      };
    }

    tickets.forEach((ticket) => {
      const createdDate = ticket.createdAt.split("T")[0];
      if (trends[createdDate]) {
        trends[createdDate].created++;
      }

      if (ticket.status === TICKET_STATUSES.DONE && ticket.activityLog) {
        const completedEntry = ticket.activityLog.find(
          (a) => a.action === "UPDATED" && a.details?.status === TICKET_STATUSES.DONE
        );
        if (completedEntry) {
          const completedDate = completedEntry.timestamp.split("T")[0];
          if (trends[completedDate]) {
            trends[completedDate].completed++;
          }
        }
      }
    });

    res.success(
      Object.entries(trends)
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => new Date(a.date) - new Date(b.date))
    );
  }),
};

/**
 * Calculate average completion time for tickets
 */
function calculateAverageCompletionTime(tickets) {
  const completedTickets = tickets.filter(
    (t) => t.status === TICKET_STATUSES.DONE && t.activityLog
  );

  if (completedTickets.length === 0) return 0;

  let totalTime = 0;
  let count = 0;

  completedTickets.forEach((ticket) => {
    const createdAt = new Date(ticket.createdAt);
    const completedEntry = ticket.activityLog.find(
      (a) => a.action === "UPDATED" && a.details?.status === TICKET_STATUSES.DONE
    );

    if (completedEntry) {
      const completedAt = new Date(completedEntry.timestamp);
      totalTime += completedAt - createdAt;
      count++;
    }
  });

  if (count === 0) return 0;

  // Return average in hours
  return Math.round(totalTime / count / (1000 * 60 * 60));
}

/**
 * Generate daily stats
 */
function generateDailyStats(tickets, start, end) {
  const stats = {};
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

  for (let i = 0; i <= days; i++) {
    const date = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split("T")[0];
    stats[dateStr] = {
      created: 0,
      completed: 0,
      byStatus: {
        BACKLOG: 0,
        ACTIVE: 0,
        IN_PROGRESS: 0,
        IN_REVIEW: 0,
        DONE: 0,
      },
    };
  }

  tickets.forEach((ticket) => {
    const createdDate = ticket.createdAt.split("T")[0];
    if (stats[createdDate]) {
      stats[createdDate].created++;
    }

    const currentStatus = ticket.status;
    const today = new Date().toISOString().split("T")[0];
    if (stats[today] && currentStatus) {
      stats[today].byStatus[currentStatus]++;
    }
  });

  return Object.entries(stats).map(([date, data]) => ({ date, ...data }));
}

module.exports = AnalyticsController;
