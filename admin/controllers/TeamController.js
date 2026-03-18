const { DynamoDBService } = require("../../shared/utils/DynamoDB");
const { TABLES, USER_ROLES } = require("../../shared/config/Constants");
const { APIError, asyncHandler } = require("../../shared/middleware/ErrorHandler");

/**
 * Team Controller
 */
const TeamController = {
  /**
   * Get team members
   */
  getMembers: asyncHandler(async (req, res) => {
    const { organisationId } = req.user;

    if (!organisationId) {
      throw new APIError("User is not part of an organisation", "NO_ORG", 400);
    }

    const result = await DynamoDBService.scan(TABLES.USERS, {
      filterExpression: "organisationId = :orgId",
      expressionAttributeValues: { ":orgId": organisationId },
    });

    const members = result.items.map((user) => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    res.success(members);
  }),

  /**
   * Get team statistics
   */
  getStats: asyncHandler(async (req, res) => {
    const { organisationId } = req.user;

    if (!organisationId) {
      throw new APIError("User is not part of an organisation", "NO_ORG", 400);
    }

    const usersResult = await DynamoDBService.scan(TABLES.USERS, {
      filterExpression: "organisationId = :orgId",
      expressionAttributeValues: { ":orgId": organisationId },
    });

    const ticketsResult = await DynamoDBService.scan(TABLES.TICKETS, {
      filterExpression: "orgId = :orgId",
      expressionAttributeValues: { ":orgId": organisationId },
    });

    const members = usersResult.items;
    const tickets = ticketsResult.items;

    // Calculate stats
    const stats = {
      totalMembers: members.length,
      roleDistribution: {
        ADMIN: members.filter((m) => m.role === USER_ROLES.ADMIN).length,
        MANAGER: members.filter((m) => m.role === USER_ROLES.MANAGER).length,
        MEMBER: members.filter((m) => m.role === USER_ROLES.MEMBER).length,
      },
      totalTickets: tickets.length,
      ticketsByStatus: {
        BACKLOG: tickets.filter((t) => t.status === "BACKLOG").length,
        ACTIVE: tickets.filter((t) => t.status === "ACTIVE").length,
        IN_PROGRESS: tickets.filter((t) => t.status === "IN_PROGRESS").length,
        IN_REVIEW: tickets.filter((t) => t.status === "IN_REVIEW").length,
        DONE: tickets.filter((t) => t.status === "DONE").length,
      },
      memberStats: members.map((member) => {
        const memberTickets = tickets.filter((t) => t.assigneeId === member.userId);
        return {
          userId: member.userId,
          name: member.name,
          email: member.email,
          role: member.role,
          ticketCount: memberTickets.length,
          completedTickets: memberTickets.filter((t) => t.status === "DONE").length,
          overdueTickets: memberTickets.filter(
            (t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== "DONE"
          ).length,
        };
      }),
    };

    res.success(stats);
  }),

  /**
   * Update member role (admin only)
   */
  updateMemberRole: asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { organisationId, role: currentUserRole } = req.user;
    const { role } = req.body;

    if (!organisationId) {
      throw new APIError("User is not part of an organisation", "NO_ORG", 400);
    }

    if (currentUserRole !== USER_ROLES.ADMIN) {
      throw new APIError("Only admins can update member roles", "FORBIDDEN", 403);
    }

    if (!Object.values(USER_ROLES).includes(role)) {
      throw new APIError("Invalid role", "VALIDATION_ERROR", 400);
    }

    // Find the member by scanning (no UserIdIndex GSI available)
    const memberScan = await DynamoDBService.scan(TABLES.USERS, {
      filterExpression: "userId = :uid",
      expressionAttributeValues: { ":uid": userId },
    });
    const member = memberScan.items && memberScan.items[0];

    if (!member) {
      throw new APIError("Member not found", "NOT_FOUND", 404);
    }

    if (member.organisationId !== organisationId) {
      throw new APIError("Member is not in your organisation", "FORBIDDEN", 403);
    }

    if (userId === req.user.userId) {
      throw new APIError("Cannot change your own role", "FORBIDDEN", 403);
    }

    const updated = await DynamoDBService.update(
      TABLES.USERS,
      { email: member.email },
      { role, updatedAt: new Date().toISOString() }
    );

    const { password, ...userWithoutPassword } = updated;
    res.success(userWithoutPassword, "Member role updated successfully");
  }),

  /**
   * Remove team member (admin only)
   */
  removeMember: asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { organisationId, role: currentUserRole } = req.user;

    if (!organisationId) {
      throw new APIError("User is not part of an organisation", "NO_ORG", 400);
    }

    if (currentUserRole !== USER_ROLES.ADMIN) {
      throw new APIError("Only admins can remove members", "FORBIDDEN", 403);
    }

    const memberScan = await DynamoDBService.scan(TABLES.USERS, {
      filterExpression: "userId = :uid",
      expressionAttributeValues: { ":uid": userId },
    });
    const member = memberScan.items && memberScan.items[0];

    if (!member) {
      throw new APIError("Member not found", "NOT_FOUND", 404);
    }

    if (member.organisationId !== organisationId) {
      throw new APIError("Member is not in your organisation", "FORBIDDEN", 403);
    }

    if (userId === req.user.userId) {
      throw new APIError("Cannot remove yourself", "FORBIDDEN", 403);
    }

    await DynamoDBService.update(
      TABLES.USERS,
      { email: member.email },
      { organisationId: null, role: USER_ROLES.MEMBER, updatedAt: new Date().toISOString() }
    );

    res.success(null, "Member removed successfully");
  }),
};

module.exports = TeamController;
