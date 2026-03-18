const { v4: uuidv4 } = require("uuid");
const { DynamoDBService } = require("../../shared/utils/DynamoDB");
const { TABLES, TICKET_STATUSES, TICKET_PRIORITIES } = require("../../shared/config/Constants");
const { APIError, asyncHandler } = require("../../shared/middleware/ErrorHandler");

/**
 * Ticket Controller
 * NOTE: DynamoDB GSIs (OrgIndex, AssigneeIndex) don't exist on these tables.
 * We use scan+filter instead. For production scale, create the GSIs in AWS console.
 */
const TicketController = {
  /**
   * Get all tickets for user's organisation
   */
  getTickets: asyncHandler(async (req, res) => {
    const { userId, organisationId } = req.user;
    const { status, assigneeId, priority } = req.query;

    if (!organisationId) {
      throw new APIError("User is not part of an organisation", "NO_ORG", 400);
    }

    // Scan tickets filtered by orgId (no OrgIndex GSI available)
    const result = await DynamoDBService.scan(TABLES.TICKETS, {
      filterExpression: "orgId = :orgId",
      expressionAttributeValues: { ":orgId": organisationId },
    });

    let tickets = result.items;

    // Apply additional filters in memory
    if (status) tickets = tickets.filter((t) => t.status === status);
    if (assigneeId) tickets = tickets.filter((t) => t.assigneeId === assigneeId);
    if (priority) tickets = tickets.filter((t) => t.priority === priority);

    tickets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.success(tickets);
  }),

  /**
   * Get tickets assigned to current user
   */
  getMyTickets: asyncHandler(async (req, res) => {
    const { userId } = req.user;

    // Scan by assigneeId (no AssigneeIndex GSI available)
    const result = await DynamoDBService.scan(TABLES.TICKETS, {
      filterExpression: "assigneeId = :userId",
      expressionAttributeValues: { ":userId": userId },
    });

    const tickets = result.items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.success(tickets);
  }),

  /**
   * Get overdue tickets
   */
  getOverdueTickets: asyncHandler(async (req, res) => {
    const { organisationId } = req.user;

    if (!organisationId) {
      throw new APIError("User is not part of an organisation", "NO_ORG", 400);
    }

    const now = new Date().toISOString();

    const result = await DynamoDBService.scan(TABLES.TICKETS, {
      filterExpression:
        "orgId = :orgId AND #deadline < :now AND #status <> :done",
      expressionAttributeNames: {
        "#deadline": "deadline",
        "#status": "status",
      },
      expressionAttributeValues: {
        ":orgId": organisationId,
        ":now": now,
        ":done": TICKET_STATUSES.DONE,
      },
    });

    res.success(result.items);
  }),

  /**
   * Get a single ticket
   */
  getTicket: asyncHandler(async (req, res) => {
    const { ticketId } = req.params;
    const { organisationId } = req.user;

    const ticket = await DynamoDBService.get(TABLES.TICKETS, { ticketId });

    if (!ticket) {
      throw new APIError("Ticket not found", "NOT_FOUND", 404);
    }

    if (ticket.orgId !== organisationId) {
      throw new APIError("Access denied", "FORBIDDEN", 403);
    }

    res.success(ticket);
  }),

  /**
   * Create a new ticket
   */
  createTicket: asyncHandler(async (req, res) => {
    const { userId, organisationId } = req.user;
    const {
      title,
      description,
      assigneeId,
      coAssignees,
      reviewerId,
      priority = TICKET_PRIORITIES.MEDIUM,
      deadline,
      sourceType = "MANUAL",
    } = req.body;

    if (!organisationId) {
      throw new APIError("User is not part of an organisation", "NO_ORG", 400);
    }

    if (!title) {
      throw new APIError("Title is required", "VALIDATION_ERROR", 400);
    }

    const ticketId = uuidv4();
    const now = new Date().toISOString();

    const ticket = {
      ticketId,
      orgId: organisationId,
      title,
      description: description || "",
      status: TICKET_STATUSES.BACKLOG,
      priority,
      // IMPORTANT: omit assigneeId/reviewerId entirely if null/undefined
      // to avoid breaking sparse GSI constraints
      ...(assigneeId && { assigneeId }),
      coAssignees: coAssignees || [],
      ...(reviewerId && { reviewerId }),
      createdBy: userId,
      ...(deadline && { deadline }),
      sourceType,
      createdAt: now,
      updatedAt: now,
      comments: [],
      activityLog: [
        {
          id: uuidv4(),
          action: "CREATED",
          userId,
          timestamp: now,
          details: { title },
        },
      ],
    };

    await DynamoDBService.put(TABLES.TICKETS, ticket);

    res.success(ticket, "Ticket created successfully", 201);
  }),

  /**
   * Update a ticket
   */
  updateTicket: asyncHandler(async (req, res) => {
    const { ticketId } = req.params;
    const { userId, organisationId } = req.user;
    const updates = req.body;

    const ticket = await DynamoDBService.get(TABLES.TICKETS, { ticketId });

    if (!ticket) {
      throw new APIError("Ticket not found", "NOT_FOUND", 404);
    }

    if (ticket.orgId !== organisationId) {
      throw new APIError("Access denied", "FORBIDDEN", 403);
    }

    // Build update object
    const updateData = {
      updatedAt: new Date().toISOString(),
    };

    if (updates.title) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.status) updateData.status = updates.status;
    if (updates.priority) updateData.priority = updates.priority;
    if (updates.assigneeId !== undefined) updateData.assigneeId = updates.assigneeId || null;
    if (updates.coAssignees) updateData.coAssignees = updates.coAssignees;
    if (updates.reviewerId !== undefined) updateData.reviewerId = updates.reviewerId || null;
    if (updates.deadline !== undefined) updateData.deadline = updates.deadline || null;

    // Add activity log entry
    const activityEntry = {
      id: uuidv4(),
      action: "UPDATED",
      userId,
      timestamp: new Date().toISOString(),
      details: updates,
    };

    updateData.activityLog = [...(ticket.activityLog || []), activityEntry];

    const updatedTicket = await DynamoDBService.update(
      TABLES.TICKETS,
      { ticketId },
      updateData
    );

    res.success(updatedTicket, "Ticket updated successfully");
  }),

  /**
   * Delete a ticket
   */
  deleteTicket: asyncHandler(async (req, res) => {
    const { ticketId } = req.params;
    const { organisationId } = req.user;

    const ticket = await DynamoDBService.get(TABLES.TICKETS, { ticketId });

    if (!ticket) {
      throw new APIError("Ticket not found", "NOT_FOUND", 404);
    }

    if (ticket.orgId !== organisationId) {
      throw new APIError("Access denied", "FORBIDDEN", 403);
    }

    await DynamoDBService.delete(TABLES.TICKETS, { ticketId });

    res.success(null, "Ticket deleted successfully");
  }),

  /**
   * Add a comment to a ticket
   */
  addComment: asyncHandler(async (req, res) => {
    const { ticketId } = req.params;
    const { userId, organisationId } = req.user;
    const { content } = req.body;

    if (!content) {
      throw new APIError("Comment content is required", "VALIDATION_ERROR", 400);
    }

    const ticket = await DynamoDBService.get(TABLES.TICKETS, { ticketId });

    if (!ticket) {
      throw new APIError("Ticket not found", "NOT_FOUND", 404);
    }

    if (ticket.orgId !== organisationId) {
      throw new APIError("Access denied", "FORBIDDEN", 403);
    }

    const comment = {
      id: uuidv4(),
      userId,
      content,
      createdAt: new Date().toISOString(),
    };

    const updatedComments = [...(ticket.comments || []), comment];

    const updatedTicket = await DynamoDBService.update(
      TABLES.TICKETS,
      { ticketId },
      {
        comments: updatedComments,
        updatedAt: new Date().toISOString(),
      }
    );

    res.success(updatedTicket, "Comment added successfully");
  }),
};

module.exports = TicketController;
