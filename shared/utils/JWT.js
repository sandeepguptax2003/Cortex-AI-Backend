const jwt = require("jsonwebtoken");
const { JWT_CONFIG } = require("../config/Constants");

/**
 * JWT Service for token operations
 */
const JWTService = {
  /**
   * Generate an access token
   * @param {Object} payload - Token payload
   * @returns {string} - JWT token
   */
  generateAccessToken(payload) {
    return jwt.sign(payload, JWT_CONFIG.secret, {
      expiresIn: JWT_CONFIG.expiresIn,
    });
  },

  /**
   * Generate a refresh token
   * @param {Object} payload - Token payload
   * @returns {string} - JWT refresh token
   */
  generateRefreshToken(payload) {
    return jwt.sign(payload, JWT_CONFIG.secret, {
      expiresIn: JWT_CONFIG.refreshExpiresIn,
    });
  },

  /**
   * Verify a token
   * @param {string} token - JWT token
   * @returns {Object} - Decoded payload
   */
  verifyToken(token) {
    return jwt.verify(token, JWT_CONFIG.secret);
  },

  /**
   * Decode a token without verification
   * @param {string} token - JWT token
   * @returns {Object} - Decoded payload
   */
  decodeToken(token) {
    return jwt.decode(token);
  },

  /**
   * Generate token pair (access + refresh)
   * @param {Object} payload - Token payload
   * @returns {Object} - Token pair
   */
  generateTokenPair(payload) {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  },
};

/**
 * Authentication Middleware
 */
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication token required",
        },
      });
    }

    const token = authHeader.substring(7);
    const decoded = JWTService.verifyToken(token);

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        error: {
          code: "TOKEN_EXPIRED",
          message: "Token has expired",
        },
      });
    }

    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid authentication token",
      },
    });
  }
};

/**
 * Role-based access control middleware
 * @param {string[]} allowedRoles - Array of allowed roles
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "You don't have permission to access this resource",
        },
      });
    }

    next();
  };
};

module.exports = {
  JWTService,
  authMiddleware,
  requireRole,
};
