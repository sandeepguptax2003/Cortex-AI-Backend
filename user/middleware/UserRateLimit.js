const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");

// User-specific rate limiter for ticket operations
const ticketLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // raised from 50
  message: {
    success: false,
    error: {
      code: "TICKET_RATE_LIMIT_EXCEEDED",
      message: "Too many ticket operations, please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// User meeting rate limiter
const meetingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 200, // raised from 20
  message: {
    success: false,
    error: {
      code: "MEETING_RATE_LIMIT_EXCEEDED",
      message: "Too many meeting operations, please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// User notification rate limiter
const notificationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // raised from 30
  message: {
    success: false,
    error: {
      code: "NOTIFICATION_RATE_LIMIT_EXCEEDED",
      message: "Too many notification requests, please slow down.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// User profile rate limiter
const profileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // raised from 20
  message: {
    success: false,
    error: {
      code: "PROFILE_RATE_LIMIT_EXCEEDED",
      message: "Too many profile updates, please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const userSpeedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 100,
  delayMs: () => 500,
});

module.exports = {
  ticketLimiter,
  meetingLimiter,
  notificationLimiter,
  profileLimiter,
  userSpeedLimiter,
};
