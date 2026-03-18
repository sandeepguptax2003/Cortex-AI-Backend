const { DynamoDBService } = require("../../../shared/utils/DynamoDB");
const { TABLES } = require("../../../shared/config/Constants");
const { asyncHandler } = require("../../../shared/middleware/ErrorHandler");

/**
 * Bot Controller
 * Handles bot-related operations and commands
 */
const BotController = {
  /**
   * Process bot command
   */
  processCommand: asyncHandler(async (req, res) => {
    const { command, args, source, userId, orgId } = req.body;

    if (!command) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Command is required",
        },
      });
    }

    let result;

    switch (command.toLowerCase()) {
      case "create_ticket":
      case "createticket":
        result = await BotController.createTicketFromCommand(args, userId, orgId);
        break;

      case "list_tickets":
      case "listtickets":
        result = await BotController.listTickets(userId, orgId);
        break;

      case "my_tickets":
      case "mytickets":
        result = await BotController.getMyTickets(userId, orgId);
        break;

      case "help":
        result = BotController.getHelpMessage();
        break;

      default:
        result = {
          success: false,
          message: `Unknown command: ${command}. Type "help" for available commands.`,
        };
    }

    res.success(result);
  }),

  /**
   * Create ticket from bot command
   */
  async createTicketFromCommand(args, userId, orgId) {
    try {
      if (!args || args.length === 0) {
        return {
          success: false,
          message: "Please provide a ticket title. Usage: create_ticket <title>",
        };
      }

      const title = args.join(" ");
      const { v4: uuidv4 } = require("uuid");

      const ticket = {
        ticketId: uuidv4(),
        orgId,
        title,
        description: "Created via bot",
        status: "BACKLOG",
        priority: "MEDIUM",
        assigneeId: userId,
        coAssignees: [],
        reviewerId: null,
        createdBy: userId,
        deadline: null,
        sourceType: "BOT",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        comments: [],
        activityLog: [
          {
            id: uuidv4(),
            action: "CREATED",
            userId,
            timestamp: new Date().toISOString(),
            details: { title, source: "BOT" },
          },
        ],
      };

      await DynamoDBService.put(TABLES.TICKETS, ticket);

      return {
        success: true,
        message: `Ticket "${title}" created successfully!`,
        ticketId: ticket.ticketId,
      };
    } catch (error) {
      console.error("Error creating ticket from bot:", error);
      return {
        success: false,
        message: "Failed to create ticket. Please try again.",
      };
    }
  },

  /**
   * List tickets for organisation
   */
  async listTickets(userId, orgId) {
    try {
      if (!orgId) {
        return {
          success: false,
          message: "You are not part of an organisation.",
        };
      }

      const result = await DynamoDBService.query(TABLES.TICKETS, {
        indexName: "OrgIndex",
        keyConditionExpression: "orgId = :orgId",
        expressionAttributeValues: {
          ":orgId": orgId,
        },
      });

      const tickets = result.items.slice(0, 10); // Limit to 10 tickets

      if (tickets.length === 0) {
        return {
          success: true,
          message: "No tickets found.",
          tickets: [],
        };
      }

      const ticketList = tickets
        .map((t) => `• ${t.title} (${t.status})`)
        .join("\n");

      return {
        success: true,
        message: `Recent tickets:\n${ticketList}`,
        tickets: tickets.map((t) => ({
          ticketId: t.ticketId,
          title: t.title,
          status: t.status,
        })),
      };
    } catch (error) {
      console.error("Error listing tickets:", error);
      return {
        success: false,
        message: "Failed to list tickets. Please try again.",
      };
    }
  },

  /**
   * Get my tickets
   */
  async getMyTickets(userId, orgId) {
    try {
      if (!orgId) {
        return {
          success: false,
          message: "You are not part of an organisation.",
        };
      }

      const result = await DynamoDBService.query(TABLES.TICKETS, {
        indexName: "AssigneeIndex",
        keyConditionExpression: "assigneeId = :assigneeId",
        expressionAttributeValues: {
          ":assigneeId": userId,
        },
      });

      const tickets = result.items.filter((t) => t.orgId === orgId).slice(0, 10);

      if (tickets.length === 0) {
        return {
          success: true,
          message: "You have no assigned tickets.",
          tickets: [],
        };
      }

      const ticketList = tickets
        .map((t) => `• ${t.title} (${t.status})`)
        .join("\n");

      return {
        success: true,
        message: `Your tickets:\n${ticketList}`,
        tickets: tickets.map((t) => ({
          ticketId: t.ticketId,
          title: t.title,
          status: t.status,
        })),
      };
    } catch (error) {
      console.error("Error getting my tickets:", error);
      return {
        success: false,
        message: "Failed to get your tickets. Please try again.",
      };
    }
  },

  /**
   * Get help message
   */
  getHelpMessage() {
    return {
      success: true,
      message: `Available commands:
• create_ticket <title> - Create a new ticket
• list_tickets - List recent tickets
• my_tickets - List your assigned tickets
• help - Show this help message`,
    };
  },

  /**
   * Get bot status
   */
  getStatus: asyncHandler(async (req, res) => {
    res.success({
      status: "online",
      version: "1.0.0",
      commands: ["create_ticket", "list_tickets", "my_tickets", "help"],
    });
  }),
};

module.exports = BotController;
