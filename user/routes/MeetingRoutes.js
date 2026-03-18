const express = require("express");
const MeetingController = require("../controllers/MeetingController");
const { authenticate } = require("../../auth/middleware/AuthMiddleware");
const { meetingLimiter } = require("../middleware/UserRateLimit");

const router = express.Router();

// All meeting routes require authentication
router.use(authenticate);
router.use(meetingLimiter);

// GET /user/meetings - Get all meetings
router.get("/meetings", MeetingController.getMeetings);

// GET /user/meetings/active - Get active meeting
router.get("/meetings/active", MeetingController.getActiveMeeting);

// GET /user/meetings/:meetingId - Get single meeting
router.get("/meetings/:meetingId", MeetingController.getMeeting);

// POST /user/meetings/start - Start meeting
router.post("/meetings/start", MeetingController.startMeeting);

// POST /user/meetings/:meetingId/end - End meeting
router.post("/meetings/:meetingId/end", MeetingController.endMeeting);

// POST /user/meetings/:meetingId/captions - Add captions
router.post("/meetings/:meetingId/captions", MeetingController.addCaptions);

module.exports = router;
