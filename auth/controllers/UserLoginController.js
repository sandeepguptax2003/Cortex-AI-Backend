const { DynamoDBService } = require("../../shared/utils/DynamoDB");
const { JWTService } = require("../../shared/utils/JWT");
const { TABLES } = require("../../shared/config/Constants");
const { APIError, asyncHandler } = require("../../shared/middleware/ErrorHandler");

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const UserLoginController = {
  login: asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new APIError("Email and password are required", "VALIDATION_ERROR", 400);
    }

    const user = await DynamoDBService.get(TABLES.USERS, { email: email.toLowerCase() });

    if (!user) {
      throw new APIError("Invalid email or password", "INVALID_CREDENTIALS", 401);
    }

    if (!user.isActive) {
      throw new APIError("Account has been deactivated", "ACCOUNT_INACTIVE", 403);
    }

    if (user.password !== password) {
      throw new APIError("Invalid email or password", "INVALID_CREDENTIALS", 401);
    }

    await DynamoDBService.update(
      TABLES.USERS,
      { email: user.email },
      { lastLoginAt: new Date().toISOString() }
    );

    const tokens = JWTService.generateTokenPair({
      userId: user.userId,
      email: user.email,
      role: user.role,
      organisationId: user.organisationId,
    });

    const { password: _, ...userWithoutPassword } = user;

    res.cookie("token", tokens.accessToken, COOKIE_OPTIONS);
    res.cookie("refreshToken", tokens.refreshToken, { ...COOKIE_OPTIONS, maxAge: 30 * 24 * 60 * 60 * 1000 });

    res.success({
      user: userWithoutPassword,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  }),

  refreshToken: asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      throw new APIError("Refresh token is required", "VALIDATION_ERROR", 400);
    }

    try {
      const decoded = JWTService.verifyToken(refreshToken);

      const tokens = JWTService.generateTokenPair({
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        organisationId: decoded.organisationId,
      });

      res.cookie("token", tokens.accessToken, COOKIE_OPTIONS);
      res.cookie("refreshToken", tokens.refreshToken, { ...COOKIE_OPTIONS, maxAge: 30 * 24 * 60 * 60 * 1000 });

      res.success(tokens);
    } catch (error) {
      throw new APIError("Invalid or expired refresh token", "INVALID_TOKEN", 401);
    }
  }),

  logout: asyncHandler(async (req, res) => {
    res.clearCookie("token", COOKIE_OPTIONS);
    res.clearCookie("refreshToken", COOKIE_OPTIONS);
    res.success(null, "Logged out successfully");
  }),
};

module.exports = UserLoginController;
