const axios = require("axios");
const { DynamoDBService } = require("../../../shared/utils/DynamoDB");
const { TABLES, SLACK_CONFIG } = require("../../../shared/config/Constants");
const { APIError, asyncHandler } = require("../../../shared/middleware/ErrorHandler");

/**
 * Slack Controller
 */
const SlackController = {
  /**
   * Get Slack connection status
   */
  getStatus: asyncHandler(async (req, res) => {
    const { organisationId } = req.user;

    if (!organisationId) {
      throw new APIError("User is not part of an organisation", "NO_ORG", 400);
    }

    const org = await DynamoDBService.get(TABLES.ORGANISATIONS, { orgId: organisationId });

    res.success({
      connected: org?.slackConnected || false,
      teamName: org?.slackTeamName || null,
      teamId: org?.slackTeamId || null,
    });
  }),

  /**
   * Handle Slack OAuth callback
   */
  handleOAuth: asyncHandler(async (req, res) => {
    const { organisationId } = req.user;
    const { code, state } = req.body;

    if (!organisationId) {
      throw new APIError("User is not part of an organisation", "NO_ORG", 400);
    }

    if (!code) {
      throw new APIError("Authorization code is required", "VALIDATION_ERROR", 400);
    }

    try {
      // Exchange code for access token
      const tokenResponse = await axios.post(
        "https://slack.com/api/oauth.v2.access",
        null,
        {
          params: {
            client_id: SLACK_CONFIG.clientId,
            client_secret: SLACK_CONFIG.clientSecret,
            code,
            redirect_uri: SLACK_CONFIG.redirectUri,
          },
        }
      );

      if (!tokenResponse.data.ok) {
        throw new APIError(
          tokenResponse.data.error || "Slack OAuth failed",
          "OAUTH_FAILED",
          400
        );
      }

      const { access_token, team } = tokenResponse.data;

      // Update organisation with Slack details
      await DynamoDBService.update(
        TABLES.ORGANISATIONS,
        { orgId: organisationId },
        {
          slackConnected: true,
          slackTeamId: team.id,
          slackTeamName: team.name,
          slackAccessToken: access_token,
          updatedAt: new Date().toISOString(),
        }
      );

      res.success({
        connected: true,
        teamName: team.name,
        teamId: team.id,
      });
    } catch (error) {
      console.error("Slack OAuth error:", error);
      throw new APIError("Failed to connect Slack", "OAUTH_FAILED", 500);
    }
  }),

  /**
   * Disconnect Slack
   */
  disconnect: asyncHandler(async (req, res) => {
    const { organisationId } = req.user;

    if (!organisationId) {
      throw new APIError("User is not part of an organisation", "NO_ORG", 400);
    }

    await DynamoDBService.update(
      TABLES.ORGANISATIONS,
      { orgId: organisationId },
      {
        slackConnected: false,
        slackTeamId: null,
        slackTeamName: null,
        slackAccessToken: null,
        updatedAt: new Date().toISOString(),
      }
    );

    res.success(null, "Slack disconnected successfully");
  }),

  /**
   * Send notification to Slack channel
   */
  async sendNotification(orgId, message, options = {}) {
    try {
      const org = await DynamoDBService.get(TABLES.ORGANISATIONS, { orgId });

      if (!org?.slackConnected || !org.slackAccessToken) {
        return { success: false, error: "Slack not connected" };
      }

      const response = await axios.post(
        "https://slack.com/api/chat.postMessage",
        {
          channel: options.channel || "#general",
          text: message,
          blocks: options.blocks,
        },
        {
          headers: {
            Authorization: `Bearer ${org.slackAccessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.data.ok) {
        console.error("Slack API error:", response.data.error);
        return { success: false, error: response.data.error };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error("Slack notification error:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Handle incoming Slack events
   */
  handleEvent: asyncHandler(async (req, res) => {
    const { type, challenge, event } = req.body;

    // URL verification for Slack
    if (type === "url_verification") {
      return res.json({ challenge });
    }

    // Handle events
    if (type === "event_callback" && event) {
      // Process the event asynchronously
      SlackController.processSlackEvent(event);
    }

    // Acknowledge receipt immediately
    res.json({ ok: true });
  }),

  /**
   * Process Slack events
   */
  async processSlackEvent(event) {
    console.log("Processing Slack event:", event);

    switch (event.type) {
      case "app_mention":
        // Handle bot mentions
        break;
      case "message":
        // Handle messages
        break;
      default:
        console.log("Unhandled event type:", event.type);
    }
  },

  /**
   * Handle Slack slash commands
   */
  handleCommand: asyncHandler(async (req, res) => {
    const { command, text, user_id, team_id } = req.body;

    console.log("Slack command received:", { command, text, user_id, team_id });

    let responseText = "Command received";

    switch (command) {
      case "/cortex":
        responseText = "Welcome to Cortex AI! Use /cortex create <title> to create a ticket.";
        break;
      case "/cortex-create":
        // Create ticket logic here
        responseText = `Ticket "${text}" created successfully!`;
        break;
      default:
        responseText = "Unknown command";
    }

    res.json({
      response_type: "ephemeral",
      text: responseText,
    });
  }),
};

module.exports = SlackController;
