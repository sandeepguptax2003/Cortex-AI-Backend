const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
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
  const prompt = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  };

  const command = new InvokeModelCommand({
    modelId: BEDROCK_CONFIG.modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(prompt),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.content?.[0]?.text || "";
}

const AIChatController = {
  chat: asyncHandler(async (req, res) => {
    const { message, context = {} } = req.body;
    const { userId, organisationId, role } = req.user;

    if (!message) {
      throw new APIError("Message is required", "VALIDATION_ERROR", 400);
    }

    const systemPrompt = `You are Cortex AI, a powerful decision intelligence assistant for a team collaboration platform.

Your capabilities include:
1. Creating and managing tickets/tasks
2. Updating ticket status, priority, and assignments
3. Searching and retrieving ticket information
4. Summarizing meetings and transcripts
5. Answering questions about the platform
6. Providing analytics and insights
7. Helping with team management

When users ask you to perform actions, respond with a JSON object in this format:
{
  "type": "action|response",
  "action": "create_ticket|update_ticket|search_tickets|general",
  "data": { ...action-specific data },
  "message": "Human-friendly response"
}

Current user context:
- User ID: ${userId}
- Organisation ID: ${organisationId || "Not set"}
- Role: ${role || "Unknown"}

Be professional, concise, and helpful. Always provide clear, actionable responses.`;

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
        assigneeId: ticketData.assigneeId || null,
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
      parsedResponse.data = { tickets: result.items.slice(0, 10) };
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
