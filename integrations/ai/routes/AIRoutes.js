const express = require("express");
const AIChatController = require("../controllers/AIChatController");
const { authenticate } = require("../../../auth/middleware/AuthMiddleware");
const { apiLimiter } = require("../../../shared/config/RateLimit");

const router = express.Router();

// All AI routes require authentication and rate limiting
router.use(authenticate);
router.use(apiLimiter);

// POST /ai/chat - Send a chat message
router.post("/chat", AIChatController.chat);

// POST /ai/generate-tickets - Generate tickets from transcript
router.post("/generate-tickets", AIChatController.generateTicketSummary);

// POST /ai/summarize - Summarize transcript
router.post("/summarize", AIChatController.summarizeTranscript);

// POST /ai/command - Process AI command
router.post("/command", AIChatController.processCommand);

module.exports = router;
