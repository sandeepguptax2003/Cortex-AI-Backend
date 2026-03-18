const { v4: uuidv4 } = require("uuid");
const { DynamoDBService } = require("../../shared/utils/DynamoDB");
const { TABLES } = require("../../shared/config/Constants");
const { APIError, asyncHandler } = require("../../shared/middleware/ErrorHandler");

/**
 * Meeting Controller
 * NOTE: DynamoDB OrgIndex GSI doesn't exist. Using scan+filter instead.
 */
const MeetingController = {
  /**
   * Get all meetings for user's organisation
   */
  getMeetings: asyncHandler(async (req, res) => {
    const { organisationId } = req.user;

    if (!organisationId) {
      throw new APIError("User is not part of an organisation", "NO_ORG", 400);
    }

    const result = await DynamoDBService.scan(TABLES.MEETINGS, {
      filterExpression: "orgId = :orgId",
      expressionAttributeValues: { ":orgId": organisationId },
    });

    const meetings = result.items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.success(meetings);
  }),

  /**
   * Get a single meeting
   */
  getMeeting: asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    const { organisationId } = req.user;

    const meeting = await DynamoDBService.get(TABLES.MEETINGS, { meetingId });

    if (!meeting) {
      throw new APIError("Meeting not found", "NOT_FOUND", 404);
    }

    if (meeting.orgId !== organisationId) {
      throw new APIError("Access denied", "FORBIDDEN", 403);
    }

    res.success(meeting);
  }),

  /**
   * Get currently active meeting for user
   */
  getActiveMeeting: asyncHandler(async (req, res) => {
    const { userId, organisationId } = req.user;

    if (!organisationId) {
      throw new APIError("User is not part of an organisation", "NO_ORG", 400);
    }

    const result = await DynamoDBService.scan(TABLES.MEETINGS, {
      filterExpression: "orgId = :orgId AND #status = :active",
      expressionAttributeNames: { "#status": "status" },
      expressionAttributeValues: {
        ":orgId": organisationId,
        ":active": "ACTIVE",
      },
    });

    const activeMeeting = result.items.find(
      (m) => m.participants?.some((p) => p.userId === userId)
    );

    res.success(activeMeeting || null);
  }),

  /**
   * Start a new meeting
   */
  startMeeting: asyncHandler(async (req, res) => {
    const { userId, organisationId } = req.user;
    const { title } = req.body;

    if (!organisationId) {
      throw new APIError("User is not part of an organisation", "NO_ORG", 400);
    }

    // Check if user already has an active meeting
    const activeResult = await DynamoDBService.scan(TABLES.MEETINGS, {
      filterExpression: "orgId = :orgId AND #status = :active",
      expressionAttributeNames: { "#status": "status" },
      expressionAttributeValues: {
        ":orgId": organisationId,
        ":active": "ACTIVE",
      },
    });

    const existingActive = activeResult.items.find(
      (m) => m.participants?.some((p) => p.userId === userId)
    );

    if (existingActive) {
      throw new APIError("You already have an active meeting", "ACTIVE_MEETING_EXISTS", 409);
    }

    const meetingId = uuidv4();
    const now = new Date().toISOString();

    const meeting = {
      meetingId,
      orgId: organisationId,
      title: title || `Meeting ${new Date().toLocaleString()}`,
      status: "ACTIVE",
      createdBy: userId,
      participants: [{ userId, joinedAt: now, role: "HOST" }],
      captions: [],
      transcript: "",
      summary: null,
      createdAt: now,
      updatedAt: now,
      endedAt: null,
    };

    await DynamoDBService.put(TABLES.MEETINGS, meeting);

    res.success(meeting, "Meeting started successfully", 201);
  }),

  /**
   * End a meeting
   */
  endMeeting: asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    const { userId, organisationId } = req.user;

    const meeting = await DynamoDBService.get(TABLES.MEETINGS, { meetingId });

    if (!meeting) {
      throw new APIError("Meeting not found", "NOT_FOUND", 404);
    }

    if (meeting.orgId !== organisationId) {
      throw new APIError("Access denied", "FORBIDDEN", 403);
    }

    if (meeting.status !== "ACTIVE") {
      throw new APIError("Meeting is not active", "NOT_ACTIVE", 400);
    }

    const host = meeting.participants.find((p) => p.role === "HOST");
    if (host?.userId !== userId) {
      throw new APIError("Only the host can end the meeting", "FORBIDDEN", 403);
    }

    const now = new Date().toISOString();

    const updatedMeeting = await DynamoDBService.update(
      TABLES.MEETINGS,
      { meetingId },
      { status: "ENDED", endedAt: now, updatedAt: now }
    );

    res.success(updatedMeeting, "Meeting ended successfully");
  }),

  /**
   * Add captions to a meeting
   */
  addCaptions: asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    const { userId, organisationId } = req.user;
    const { text, timestamp } = req.body;

    if (!text) {
      throw new APIError("Caption text is required", "VALIDATION_ERROR", 400);
    }

    const meeting = await DynamoDBService.get(TABLES.MEETINGS, { meetingId });

    if (!meeting) {
      throw new APIError("Meeting not found", "NOT_FOUND", 404);
    }

    if (meeting.orgId !== organisationId) {
      throw new APIError("Access denied", "FORBIDDEN", 403);
    }

    if (meeting.status !== "ACTIVE") {
      throw new APIError("Meeting is not active", "NOT_ACTIVE", 400);
    }

    const caption = {
      id: uuidv4(),
      userId,
      text,
      timestamp: timestamp || Date.now(),
      createdAt: new Date().toISOString(),
    };

    const updatedCaptions = [...(meeting.captions || []), caption];
    const updatedTranscript = meeting.transcript
      ? `${meeting.transcript}\n${text}`
      : text;

    const updatedMeeting = await DynamoDBService.update(
      TABLES.MEETINGS,
      { meetingId },
      {
        captions: updatedCaptions,
        transcript: updatedTranscript,
        updatedAt: new Date().toISOString(),
      }
    );

    res.success(updatedMeeting, "Caption added successfully");
  }),
};

module.exports = MeetingController;
