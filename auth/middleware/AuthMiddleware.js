const { JWTService } = require("../../shared/utils/JWT");
const { USER_ROLES } = require("../../shared/config/Constants");

const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Access token is required",
        },
      });
    }

    const decoded = JWTService.verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid or expired token",
        },
      });
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      organisationId: decoded.organisationId,
      role: decoded.role,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication failed",
      },
    });
  }
};

const authorize = (...allowedRoles) => {
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

const adminOnly = authorize(USER_ROLES.ADMIN);
const adminOrManager = authorize(USER_ROLES.ADMIN, USER_ROLES.MANAGER);

module.exports = {
  authenticate,
  authorize,
  adminOnly,
  adminOrManager,
};
