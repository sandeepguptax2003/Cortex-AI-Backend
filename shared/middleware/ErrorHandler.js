const { logger } = require("./Logger");

/**
 * Custom API Error class
 */
class APIError extends Error {
  constructor(message, code, statusCode, details = null) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global Error Handler Middleware
 * Handles all errors and sends consistent error responses
 */
const globalErrorHandler = (err, req, res, next) => {
  // Log the error
  logger.error("Error occurred", err, {
    path: req.path,
    method: req.method,
    userId: req.user?.userId,
  });

  // Handle API errors
  if (err instanceof APIError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid authentication token",
      },
      timestamp: new Date().toISOString(),
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      error: {
        code: "TOKEN_EXPIRED",
        message: "Authentication token has expired",
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Handle validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: err.message,
        details: err.errors,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Handle DynamoDB errors
  if (err.name === "ResourceNotFoundException") {
    return res.status(404).json({
      success: false,
      error: {
        code: "RESOURCE_NOT_FOUND",
        message: "The requested resource was not found",
      },
      timestamp: new Date().toISOString(),
    });
  }

  if (err.name === "ConditionalCheckFailedException") {
    return res.status(409).json({
      success: false,
      error: {
        code: "RESOURCE_CONFLICT",
        message: "The resource already exists or condition failed",
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === "production"
    ? "An unexpected error occurred"
    : err.message;

  return res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || "INTERNAL_ERROR",
      message,
    },
    timestamp: new Date().toISOString(),
  });
};

/**
 * Async handler wrapper
 * Wraps async route handlers to catch errors automatically
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Not found handler
 * Creates a 404 error for undefined routes
 */
const notFoundHandler = (req, res, next) => {
  const error = new APIError(
    `Route ${req.method} ${req.path} not found`,
    "NOT_FOUND",
    404
  );
  next(error);
};

module.exports = {
  APIError,
  globalErrorHandler,
  asyncHandler,
  notFoundHandler,
};
