const express = require("express");
const SlackController = require("../controllers/SlackController");
const { authenticate } = require("../../../auth/middleware/AuthMiddleware");

const router = express.Router();

// Protected routes (auth required)
router.use(authenticate);

// GET /integrations/slack/status - Get Slack status
router.get("/status", SlackController.getStatus);

// POST /integrations/slack/oauth - Handle OAuth callback
router.post("/oauth", SlackController.handleOAuth);

// DELETE /integrations/slack/disconnect - Disconnect Slack
router.delete("/disconnect", SlackController.disconnect);

// Public routes for Slack events
router.post("/events", SlackController.handleEvent);
router.post("/command", SlackController.handleCommand);

module.exports = router;
