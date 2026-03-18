const { v4: uuidv4 } = require("uuid");
const { DynamoDBService } = require("../../shared/utils/DynamoDB");
const { TABLES } = require("../../shared/config/Constants");
const { APIError, asyncHandler } = require("../../shared/middleware/ErrorHandler");

/**
 * Transcript Controller
 * NOTE: DynamoDB OrgIndex GSI doesn't exist. Using scan+filter instead.
 * AI task extraction is done with a simple regex/keyword parser since
 * AWS Bedrock may not be configured in dev.
 */

/**
 * Simple local task extractor — looks for action items in the transcript.
 * Patterns: "will <verb>", "action item:", "TODO:", "[name]: I'll", deadlines etc.
 */
function extractTasksFromTranscript(transcript) {
  if (!transcript) return [];

  const tasks = [];
  const lines = transcript.split(/\n|\.\s+/);

  const actionPatterns = [
    /action item[s]?:?\s*(.+)/i,
    /todo[s]?:?\s*(.+)/i,
    /task[s]?:?\s*(.+)/i,
    /(?:will|going to|need to|should|must|have to|assigned to)\s+(.{10,80})/i,
    /(.{10,80})\s+(?:by|due|before|until)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|end of day|eod|next week|\d+\/\d+)/i,
  ];

  // Also look for "[Name]: I'll/I will" patterns
  const speakerPattern = /^[\w\s]+:\s+(?:I['']ll|I will|I'm going to|I can|I should)\s+(.{10,80})/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 15) continue;

    // Check speaker pattern first
    const speakerMatch = trimmed.match(speakerPattern);
    if (speakerMatch) {
      tasks.push(speakerMatch[1].replace(/[,.]$/, "").trim());
      continue;
    }

    // Check action patterns
    for (const pattern of actionPatterns) {
      const match = trimmed.match(pattern);
      if (match && match[1]) {
        const task = match[1].replace(/[,.]$/, "").trim();
        if (task.length >= 10 && task.length <= 120) {
          tasks.push(task);
          break;
        }
      }
    }
  }

  // Deduplicate
  return [...new Set(tasks)].slice(0, 20); // max 20 tasks
}

const TranscriptController = {
  /**
   * Get all transcripts for user's organisation
   */
  getTranscripts: asyncHandler(async (req, res) => {
    const { organisationId } = req.user;

    if (!organisationId) {
      throw new APIError("User is not part of an organisation", "NO_ORG", 400);
    }

    // Scan meetings that belong to this org and have a transcript (no OrgIndex GSI)
    const result = await DynamoDBService.scan(TABLES.MEETINGS, {
      filterExpression: "orgId = :orgId AND attribute_exists(transcript) AND transcript <> :empty",
      expressionAttributeValues: {
        ":orgId": organisationId,
        ":empty": "",
      },
    });

    const transcripts = result.items
      .filter((m) => m.transcript)
      .map((m) => ({
        meetingId: m.meetingId,
        title: m.title,
        transcript: m.transcript,
        summary: m.summary,
        extractedTasks: m.extractedTasks || [],
        createdAt: m.createdAt,
        endedAt: m.endedAt,
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.success(transcripts);
  }),

  /**
   * Upload a transcript and extract tasks using local parser
   */
  uploadTranscript: asyncHandler(async (req, res) => {
    const { userId, organisationId } = req.user;
    const { title, content } = req.body;

    if (!organisationId) {
      throw new APIError("User is not part of an organisation", "NO_ORG", 400);
    }

    if (!title || !content) {
      throw new APIError("Title and content are required", "VALIDATION_ERROR", 400);
    }

    // Extract tasks from transcript using local parser
    const extractedTaskTitles = extractTasksFromTranscript(content);

    // Create a meeting record for the transcript
    const meetingId = uuidv4();
    const now = new Date().toISOString();

    const meeting = {
      meetingId,
      orgId: organisationId,
      title,
      status: "ENDED",
      createdBy: userId,
      participants: [{ userId, joinedAt: now, role: "HOST" }],
      captions: [],
      transcript: content,
      summary: `Uploaded transcript with ${extractedTaskTitles.length} extracted task(s).`,
      extractedTasks: extractedTaskTitles,
      createdAt: now,
      updatedAt: now,
      endedAt: now,
      source: "UPLOAD",
    };

    await DynamoDBService.put(TABLES.MEETINGS, meeting);

    res.success(
      {
        ...meeting,
        tasksExtracted: extractedTaskTitles.length,
      },
      `Transcript uploaded. ${extractedTaskTitles.length} task(s) extracted.`,
      201
    );
  }),

  /**
   * Generate tickets from transcript using AI
   */
  generateTickets: asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    const { organisationId } = req.user;

    const meeting = await DynamoDBService.get(TABLES.MEETINGS, { meetingId });

    if (!meeting) {
      throw new APIError("Meeting not found", "NOT_FOUND", 404);
    }

    if (meeting.orgId !== organisationId) {
      throw new APIError("Access denied", "FORBIDDEN", 403);
    }

    if (!meeting.transcript) {
      throw new APIError("No transcript available", "NO_TRANSCRIPT", 400);
    }

    // Extract tasks from the transcript
    const extractedTaskTitles = extractTasksFromTranscript(meeting.transcript);

    // Update the meeting with extracted tasks
    if (extractedTaskTitles.length > 0) {
      await DynamoDBService.update(
        TABLES.MEETINGS,
        { meetingId },
        {
          extractedTasks: extractedTaskTitles,
          updatedAt: new Date().toISOString(),
        }
      );
    }

    res.success(
      {
        meetingId,
        extractedTasks: extractedTaskTitles,
        tasksExtracted: extractedTaskTitles.length,
      },
      `${extractedTaskTitles.length} task(s) extracted from transcript.`
    );
  }),
};

module.exports = TranscriptController;
