const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const { RATE_LIMITS } = require("./Constants");

// General rate limiter
const generalLimiter = rateLimit({
  windowMs: RATE_LIMITS.general.windowMs,
  max: RATE_LIMITS.general.max,
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests, please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth rate limiter (stricter for login/signup)
const authLimiter = rateLimit({
  windowMs: RATE_LIMITS.auth.windowMs,
  max: RATE_LIMITS.auth.max,
  message: {
    success: false,
    error: {
      code: "AUTH_RATE_LIMIT_EXCEEDED",
      message: "Too many authentication attempts, please try again later.",
    },
  },
  skipSuccessfulRequests: true,
});

// API rate limiter
const apiLimiter = rateLimit({
  windowMs: RATE_LIMITS.api.windowMs,
  max: RATE_LIMITS.api.max,
  message: {
    success: false,
    error: {
      code: "API_RATE_LIMIT_EXCEEDED",
      message: "API rate limit exceeded, please slow down.",
    },
  },
});

const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: () => 500,
});

module.exports = {
  generalLimiter,
  authLimiter,
  apiLimiter,
  speedLimiter,
};
