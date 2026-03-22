const { v4: uuidv4 } = require("uuid");
const { DynamoDBService } = require("../../shared/utils/DynamoDB");
const { JWTService } = require("../../shared/utils/JWT");
const { TABLES, USER_ROLES } = require("../../shared/config/Constants");
const { APIError, asyncHandler } = require("../../shared/middleware/ErrorHandler");

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const UserSignupController = {
  signup: asyncHandler(async (req, res) => {
    const { email, password, name, orgId, inviteToken } = req.body;

    if (!email || !password || !name) {
      throw new APIError("Email, password, and name are required", "VALIDATION_ERROR", 400);
    }

    if (password.length < 8) {
      throw new APIError("Password must be at least 8 characters long", "VALIDATION_ERROR", 400);
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      throw new APIError(
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
        "VALIDATION_ERROR",
        400
      );
    }

    const existingUser = await DynamoDBService.get(TABLES.USERS, { email: email.toLowerCase() });
    if (existingUser) {
      throw new APIError("User with this email already exists", "USER_EXISTS", 409);
    }

    let organisationId = orgId;
    let role = USER_ROLES.ADMIN;

    if (inviteToken) {
      const invite = await DynamoDBService.get(TABLES.INVITES, { token: inviteToken });
      if (!invite || invite.used || new Date(invite.expiresAt) < new Date()) {
        throw new APIError("Invalid or expired invite token", "INVALID_INVITE", 400);
      }
      organisationId = invite.orgId;
      role = invite.invitedRole || invite.role || USER_ROLES.MEMBER;

      await DynamoDBService.update(
        TABLES.INVITES,
        { token: inviteToken },
        { used: true, usedBy: email, usedAt: new Date().toISOString() }
      );
    }

    const userId = uuidv4();
    const now = new Date().toISOString();

    const user = {
      userId,
      email: email.toLowerCase(),
      password,
      name,
      role,
      createdAt: now,
      updatedAt: now,
      isActive: true,
      avatar: null,
      slackUserId: null,
      notificationPreferences: {
        emailTicketUpdates: true,
        emailMeetingReminders: true,
        emailDigest: false,
        slackTicketUpdates: false,
        slackMeetingReminders: true,
        browserNotifications: true,
      },
    };
    
    // Only add organisationId if it exists (to avoid GSI issues with null values)
    if (organisationId) {
      user.organisationId = organisationId;
    }

    await DynamoDBService.put(TABLES.USERS, user);

    const tokens = JWTService.generateTokenPair({
      userId: user.userId,
      email: user.email,
      role: user.role,
      organisationId: user.organisationId,
    });

    const { password: _, ...userWithoutPassword } = user;

    res.cookie("token", tokens.accessToken, COOKIE_OPTIONS);
    res.cookie("refreshToken", tokens.refreshToken, { ...COOKIE_OPTIONS, maxAge: 30 * 24 * 60 * 60 * 1000 });

    res.success(
      {
        user: userWithoutPassword,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
      "User registered successfully",
      201
    );
  }),

  checkEmail: asyncHandler(async (req, res) => {
    const { email } = req.query;

    if (!email) {
      throw new APIError("Email is required", "VALIDATION_ERROR", 400);
    }

    const existingUser = await DynamoDBService.get(TABLES.USERS, { email: email.toLowerCase() });

    res.success({
      available: !existingUser,
    });
  }),
};

module.exports = UserSignupController;
