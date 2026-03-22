const { BedrockRuntimeClient, ConverseCommand } = require("@aws-sdk/client-bedrock-runtime");
const { v4: uuidv4 } = require("uuid");
const { BEDROCK_CONFIG, TABLES, TICKET_STATUSES, TICKET_PRIORITIES } = require("../../../shared/config/Constants");
const { DynamoDBService } = require("../../../shared/utils/DynamoDB");
const { asyncHandler, APIError } = require("../../../shared/middleware/ErrorHandler");

const bedrockClient = new BedrockRuntimeClient({
  region: BEDROCK_CONFIG.region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function callBedrock(messages, systemPrompt, maxTokens = 2000) {
  const converseMessages = messages.map((m) => ({
    role: m.role,
    content: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
  }));

  const command = new ConverseCommand({
    modelId: BEDROCK_CONFIG.modelId,
    system: [{ text: systemPrompt }],
    messages: converseMessages,
    inferenceConfig: {
      maxTokens,
      temperature: 0.7,
    },
  });

  const response = await bedrockClient.send(command);
  return response.output?.message?.content?.[0]?.text || "";
}

const AIChatController = {
  chat: asyncHandler(async (req, res) => {
    const { message, context = {} } = req.body;
    const { userId, organisationId, role } = req.user;

    if (!message) {
      throw new APIError("Message is required", "VALIDATION_ERROR", 400);
    }

    const systemPrompt = `You are Cortex AI, a smart team assistant for a project management platform. You help users manage tickets, meetings, and team progress.

Respond with ONLY a valid JSON object — no markdown fences, no extra text outside the JSON:

{"type":"response","action":"general","data":{},"message":"<your full answer here>"}

Action values:
- create_ticket → user wants to create a task. data = { title, description, priority: LOW|MEDIUM|HIGH|URGENT }
- search_tickets → user wants to see or find tickets
- overdue_tickets → user asks what is late or overdue
- analytics → user asks for team stats or productivity overview
- general → everything else — write a complete, helpful answer in message

FORMATTING RULES for the message field (use these for rich responses):
- Use **bold** for key terms or titles
- Use numbered lists (1. 2. 3.) for step-by-step instructions
- Use bullet points (• or -) for feature lists
- Use [link text](/path) for navigation: [Meetings page](/meetings), [Board](/board), [Dashboard](/dashboard), [Settings](/settings)
- For sample code or transcripts, wrap in triple backticks: \`\`\`\\nContent here\\n\`\`\`
- Use --- on its own line for visual separators between sections
- Keep tone professional, friendly, and direct — like a helpful colleague

CRITICAL:
- The "message" field must ALWAYS be your actual answer — never a placeholder
- For how-to questions, give numbered steps with relevant page links
- For sample transcript requests, provide a realistic business meeting transcript inside triple backticks, then give exact numbered steps to use it
- For feature questions, list capabilities with bullet points

Current user:
- User ID: ${userId}
- Organisation ID: ${organisationId || "Not set"}
- Role: ${role || "Unknown"}

Return ONLY the JSON object. No explanation outside the JSON.`;

    const conversation = [{ role: "user", content: message }];
    const aiResponse = await callBedrock(conversation, systemPrompt, 2000);

    let parsedResponse;
    try {
      const jsonMatch = aiResponse.match(/```json\n?([\s\S]*?)\n?```/) ||
                       aiResponse.match(/\{[\s\S]*\}/) ||
                       [null, `{"type":"response","action":"general","message":"${aiResponse}"}`];
      parsedResponse = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } catch {
      parsedResponse = { type: "response", action: "general", message: aiResponse };
    }

    if (parsedResponse.type === "action" && parsedResponse.action === "create_ticket") {
      const ticketData = parsedResponse.data;
      const ticketId = uuidv4();
      const now = new Date().toISOString();

      const ticket = {
        ticketId,
        orgId: organisationId,
        title: ticketData.title,
        description: ticketData.description || "",
        status: TICKET_STATUSES.BACKLOG,
        priority: ticketData.priority || TICKET_PRIORITIES.MEDIUM,
        assigneeId: ticketData.assigneeId || userId,
        coAssignees: [],
        reviewerId: null,
        createdBy: userId,
        deadline: ticketData.deadline || null,
        sourceType: "AI",
        createdAt: now,
        updatedAt: now,
        comments: [],
        activityLog: [{
          id: uuidv4(),
          action: "CREATED_BY_AI",
          userId,
          timestamp: now,
          details: { title: ticketData.title },
        }],
      };

      await DynamoDBService.put(TABLES.TICKETS, ticket);
      parsedResponse.data.ticketId = ticketId;
      parsedResponse.message = `Created ticket: ${ticketData.title}`;
    }

    if (parsedResponse.type === "action" && parsedResponse.action === "search_tickets") {
      const result = await DynamoDBService.query(TABLES.TICKETS, {
        indexName: "OrgIndex",
        keyConditionExpression: "orgId = :orgId",
        expressionAttributeValues: { ":orgId": organisationId },
      });
      const allTickets = result.items || [];
      const tickets = allTickets.slice(0, 10);
      parsedResponse.data = { tickets };
      if (tickets.length === 0) {
        parsedResponse.message = "No tickets found for your team yet.";
      } else {
        const lines = tickets.map((t) => `• **${t.title}** — ${t.status.replace(/_/g, " ")}, ${t.priority} priority`);
        parsedResponse.message = `**${allTickets.length} ticket${allTickets.length !== 1 ? "s" : ""} found** (showing ${tickets.length}):\n${lines.join("\n")}`;
      }
    }

    if (parsedResponse.type === "action" && parsedResponse.action === "overdue_tickets") {
      const result = await DynamoDBService.query(TABLES.TICKETS, {
        indexName: "OrgIndex",
        keyConditionExpression: "orgId = :orgId",
        expressionAttributeValues: { ":orgId": organisationId },
      });
      const now = new Date();
      const overdue = (result.items || []).filter(
        (t) => t.deadline && new Date(t.deadline) < now && t.status !== "DONE"
      );
      parsedResponse.data = { overdue };
      if (overdue.length === 0) {
        parsedResponse.message = "No overdue tickets. Your team is on track!";
      } else {
        const lines = overdue.slice(0, 10).map((t) => {
          const daysAgo = Math.floor((now - new Date(t.deadline)) / (1000 * 60 * 60 * 24));
          return `• **${t.title}** — ${t.priority} priority, ${daysAgo} day${daysAgo !== 1 ? "s" : ""} overdue`;
        });
        parsedResponse.message = `**${overdue.length} overdue ticket${overdue.length !== 1 ? "s" : ""}:**\n${lines.join("\n")}`;
        if (overdue.length > 10) {
          parsedResponse.message += `\n\n...and ${overdue.length - 10} more.`;
        }
      }
    }

    if (parsedResponse.type === "action" && parsedResponse.action === "analytics") {
      const result = await DynamoDBService.query(TABLES.TICKETS, {
        indexName: "OrgIndex",
        keyConditionExpression: "orgId = :orgId",
        expressionAttributeValues: { ":orgId": organisationId },
      });
      const tickets = result.items || [];
      const statusCounts = tickets.reduce((acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      }, {});
      const priorityCounts = tickets.reduce((acc, t) => {
        acc[t.priority] = (acc[t.priority] || 0) + 1;
        return acc;
      }, {});
      const overdueCount = tickets.filter(
        (t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== "DONE"
      ).length;
      const analytics = {
        totalTickets: tickets.length,
        byStatus: statusCounts,
        byPriority: priorityCounts,
        overdue: overdueCount,
        completed: statusCounts["DONE"] || 0,
        inProgress: statusCounts["IN_PROGRESS"] || 0,
      };
      parsedResponse.data = analytics;
      parsedResponse.message = `Team has ${tickets.length} total tickets — ${analytics.inProgress} in progress, ${analytics.completed} completed, ${analytics.overdue} overdue.`;
    }

    res.success({
      message: parsedResponse.message || aiResponse,
      action: parsedResponse.action,
      data: parsedResponse.data,
      timestamp: new Date().toISOString(),
    });
  }),

  generateTicketSummary: asyncHandler(async (req, res) => {
    const { transcript } = req.body;

    if (!transcript) {
      throw new APIError("Transcript is required", "VALIDATION_ERROR", 400);
    }

    const systemPrompt = `You are an AI assistant that extracts actionable tasks from meeting transcripts.
Analyze the transcript and create a JSON array of tickets with this exact structure:
[
  {
    "title": "Brief ticket title (max 100 chars)",
    "description": "Detailed description of the task",
    "priority": "LOW|MEDIUM|HIGH|CRITICAL"
  }
]

Only include clear, actionable tasks. Be concise but descriptive. Return ONLY valid JSON.`;

    const aiResponse = await callBedrock(
      [{ role: "user", content: `Extract actionable tasks from this transcript:\n\n${transcript}` }],
      systemPrompt,
      2000
    );

    let tickets = [];
    try {
      const jsonMatch = aiResponse.match(/```json\n?([\s\S]*?)\n?```/) ||
                       aiResponse.match(/```\n?([\s\S]*?)\n?```/) ||
                       [null, aiResponse];
      tickets = JSON.parse(jsonMatch[1]?.trim() || aiResponse);
    } catch {
      tickets = [];
    }

    res.success({ tickets, rawResponse: aiResponse });
  }),

  summarizeTranscript: asyncHandler(async (req, res) => {
    const { transcript } = req.body;

    if (!transcript) {
      throw new APIError("Transcript is required", "VALIDATION_ERROR", 400);
    }

    const systemPrompt = `You are an AI assistant that summarizes meeting transcripts professionally.
Provide a structured summary with these sections:

## Key Discussion Points
- Point 1
- Point 2

## Decisions Made
1. Decision 1
2. Decision 2

## Action Items
- [ ] Action item 1
- [ ] Action item 2

## Next Steps
1. Next step 1
2. Next step 2

Keep it professional and actionable.`;

    const summary = await callBedrock(
      [{ role: "user", content: `Summarize this meeting transcript:\n\n${transcript}` }],
      systemPrompt,
      2000
    );

    res.success({ summary });
  }),

  processCommand: asyncHandler(async (req, res) => {
    const { command } = req.body;
    const { userId, organisationId } = req.user;

    if (!command) {
      throw new APIError("Command is required", "VALIDATION_ERROR", 400);
    }

    const systemPrompt = `You are Cortex AI Command Processor. Parse user commands and return structured actions.

Available commands:
- "create ticket [title]" -> action: create_ticket
- "update ticket [id] status [status]" -> action: update_ticket
- "show my tickets" -> action: list_my_tickets
- "show overdue tickets" -> action: list_overdue
- "search tickets [query]" -> action: search_tickets

Return JSON: {"action": "...", "params": {...}, "response": "..."}`;

    const aiResponse = await callBedrock(
      [{ role: "user", content: command }],
      systemPrompt,
      1000
    );

    let action;
    try {
      action = JSON.parse(aiResponse.match(/\{[\s\S]*\}/)?.[0] || "{}");
    } catch {
      action = { action: "unknown", response: aiResponse };
    }

    let result = null;

    if (action.action === "create_ticket" && action.params?.title) {
      const ticketId = uuidv4();
      const now = new Date().toISOString();
      const ticket = {
        ticketId,
        orgId: organisationId,
        title: action.params.title,
        description: action.params.description || "",
        status: TICKET_STATUSES.BACKLOG,
        priority: action.params.priority || TICKET_PRIORITIES.MEDIUM,
        assigneeId: userId,
        coAssignees: [],
        reviewerId: null,
        createdBy: userId,
        deadline: null,
        sourceType: "AI_COMMAND",
        createdAt: now,
        updatedAt: now,
        comments: [],
        activityLog: [{
          id: uuidv4(),
          action: "CREATED_BY_AI_COMMAND",
          userId,
          timestamp: now,
          details: { title: action.params.title },
        }],
      };
      await DynamoDBService.put(TABLES.TICKETS, ticket);
      result = { ticketId, title: action.params.title };
    }

    if (action.action === "list_my_tickets") {
      const queryResult = await DynamoDBService.query(TABLES.TICKETS, {
        indexName: "AssigneeIndex",
        keyConditionExpression: "assigneeId = :assigneeId",
        expressionAttributeValues: { ":assigneeId": userId },
      });
      result = { tickets: queryResult.items };
    }

    res.success({
      command: action.action,
      response: action.response || "Command processed",
      result,
    });
  }),
};

module.exports = AIChatController;
