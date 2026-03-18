const express = require("express");
const TranscriptController = require("../controllers/TranscriptController");
const { authenticate } = require("../../auth/middleware/AuthMiddleware");
const { meetingLimiter } = require("../middleware/UserRateLimit");

const router = express.Router();

// All transcript routes require authentication
router.use(authenticate);
router.use(meetingLimiter);

// GET /user/transcripts - Get all transcripts
router.get("/transcripts", TranscriptController.getTranscripts);

// POST /user/transcripts - Upload transcript
router.post("/transcripts", TranscriptController.uploadTranscript);

// POST /user/transcripts/:meetingId/generate-tickets - Generate tickets
router.post("/transcripts/:meetingId/generate-tickets", TranscriptController.generateTickets);

module.exports = router;
