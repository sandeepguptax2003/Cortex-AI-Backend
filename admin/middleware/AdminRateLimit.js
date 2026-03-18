const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");

// Admin-specific rate limiter for team operations
const teamLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // raised from 30
  message: {
    success: false,
    error: {
      code: "TEAM_RATE_LIMIT_EXCEEDED",
      message: "Too many team operations, please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin invite rate limiter
const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 200, // raised from 50
  message: {
    success: false,
    error: {
      code: "INVITE_RATE_LIMIT_EXCEEDED",
      message: "Too many invite operations, please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin analytics rate limiter
const analyticsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // raised from 20
  message: {
    success: false,
    error: {
      code: "ANALYTICS_RATE_LIMIT_EXCEEDED",
      message: "Too many analytics requests, please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin organization rate limiter
const orgLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // raised from 20
  message: {
    success: false,
    error: {
      code: "ORG_RATE_LIMIT_EXCEEDED",
      message: "Too many organization operations, please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminSpeedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 100,
  delayMs: () => 200,
});

module.exports = {
  teamLimiter,
  inviteLimiter,
  analyticsLimiter,
  orgLimiter,
  adminSpeedLimiter,
};
