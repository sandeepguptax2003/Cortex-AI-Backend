const { v4: uuidv4 } = require("uuid");
const { DynamoDBService } = require("../../shared/utils/DynamoDB");
const { TABLES, USER_ROLES } = require("../../shared/config/Constants");
const { APIError, asyncHandler } = require("../../shared/middleware/ErrorHandler");

// Generate a random invite token
function generateInviteToken() {
  return uuidv4().replace(/-/g, "").substring(0, 20);
}

/**
 * Invite Controller
 */
const InviteController = {
  /**
   * Create an invite link
   */
  createInvite: asyncHandler(async (req, res) => {
    const { userId, organisationId, role } = req.user;
    const { requireDomain = false } = req.body;

    if (!organisationId) {
      throw new APIError("User is not part of an organisation", "NO_ORG", 400);
    }

    // Only admin and manager can create invites
    if (role !== USER_ROLES.ADMIN && role !== USER_ROLES.MANAGER) {
      throw new APIError("Only admins and managers can create invites", "FORBIDDEN", 403);
    }

    const token = generateInviteToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = {
      token,
      orgId: organisationId,
      createdBy: userId,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      used: false,
      usedBy: null,
      usedAt: null,
      requireDomain,
    };

    await DynamoDBService.put(TABLES.INVITES, invite);

    // Generate invite URL
    const inviteUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/signup?token=${token}&orgId=${organisationId}`;

    res.success(
      {
        ...invite,
        inviteUrl,
      },
      "Invite created successfully",
      201
    );
  }),

  /**
   * Get all invites for organisation
   */
  getInvites: asyncHandler(async (req, res) => {
    const { organisationId, role } = req.user;

    if (!organisationId) {
      throw new APIError("User is not part of an organisation", "NO_ORG", 400);
    }

    if (role !== USER_ROLES.ADMIN && role !== USER_ROLES.MANAGER) {
      throw new APIError("Only admins and managers can view invites", "FORBIDDEN", 403);
    }

    const result = await DynamoDBService.scan(TABLES.INVITES, {
      filterExpression: "orgId = :orgId",
      expressionAttributeValues: { ":orgId": organisationId },
    });

    const invites = result.items.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.success(invites);
  }),

  /**
   * Revoke an invite
   */
  revokeInvite: asyncHandler(async (req, res) => {
    const { token } = req.params;
    const { organisationId, role } = req.user;

    if (!organisationId) {
      throw new APIError("User is not part of an organisation", "NO_ORG", 400);
    }

    if (role !== USER_ROLES.ADMIN && role !== USER_ROLES.MANAGER) {
      throw new APIError("Only admins and managers can revoke invites", "FORBIDDEN", 403);
    }

    const invite = await DynamoDBService.get(TABLES.INVITES, { token });

    if (!invite) {
      throw new APIError("Invite not found", "NOT_FOUND", 404);
    }

    if (invite.orgId !== organisationId) {
      throw new APIError("Access denied", "FORBIDDEN", 403);
    }

    if (invite.used) {
      throw new APIError("Cannot revoke a used invite", "ALREADY_USED", 400);
    }

    await DynamoDBService.delete(TABLES.INVITES, { token });

    res.success(null, "Invite revoked successfully");
  }),

  /**
   * Validate an invite token
   */
  validateInvite: asyncHandler(async (req, res) => {
    const { token, orgId } = req.query;

    if (!token || !orgId) {
      throw new APIError("Token and orgId are required", "VALIDATION_ERROR", 400);
    }

    const invite = await DynamoDBService.get(TABLES.INVITES, { token });

    if (!invite) {
      throw new APIError("Invalid invite token", "INVALID_TOKEN", 400);
    }

    if (invite.orgId !== orgId) {
      throw new APIError("Invalid organisation", "INVALID_ORG", 400);
    }

    if (invite.used) {
      throw new APIError("Invite has already been used", "ALREADY_USED", 400);
    }

    if (new Date(invite.expiresAt) < new Date()) {
      throw new APIError("Invite has expired", "EXPIRED", 400);
    }

    // Get organisation details
    const org = await DynamoDBService.get(TABLES.ORGANISATIONS, { orgId });

    res.success({
      valid: true,
      organisation: org
        ? {
            orgId: org.orgId,
            name: org.name,
          }
        : null,
    });
  }),

  /**
   * Join organisation with invite
   */
  joinOrganisation: asyncHandler(async (req, res) => {
    const { token, orgId, email, password, name } = req.body;

    if (!token || !orgId || !email || !password || !name) {
      throw new APIError(
        "Token, orgId, email, password, and name are required",
        "VALIDATION_ERROR",
        400
      );
    }

    // Validate invite
    const invite = await DynamoDBService.get(TABLES.INVITES, { token });

    if (!invite || invite.orgId !== orgId) {
      throw new APIError("Invalid invite token", "INVALID_TOKEN", 400);
    }

    if (invite.used) {
      throw new APIError("Invite has already been used", "ALREADY_USED", 400);
    }

    if (new Date(invite.expiresAt) < new Date()) {
      throw new APIError("Invite has expired", "EXPIRED", 400);
    }

    // Check if email matches domain requirement
    if (invite.requireDomain) {
      const org = await DynamoDBService.get(TABLES.ORGANISATIONS, { orgId });
      if (org?.domain) {
        const emailDomain = email.split("@")[1];
        if (emailDomain !== org.domain) {
          throw new APIError(
            `Email must match the organisation domain (@${org.domain})`,
            "DOMAIN_MISMATCH",
            400
          );
        }
      }
    }

    // Check if user already exists
    const existingUser = await DynamoDBService.get(TABLES.USERS, { email: email.toLowerCase() });
    if (existingUser) {
      throw new APIError("User with this email already exists", "USER_EXISTS", 409);
    }

    // Create user
    const userId = uuidv4();
    const now = new Date().toISOString();

    const user = {
      userId,
      email: email.toLowerCase(),
      password, // Plain text as requested
      name,
      role: USER_ROLES.MEMBER,
      organisationId: orgId,
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

    await DynamoDBService.put(TABLES.USERS, user);

    // Mark invite as used
    await DynamoDBService.update(
      TABLES.INVITES,
      { token },
      {
        used: true,
        usedBy: email,
        usedAt: now,
      }
    );

    // Generate tokens
    const { JWTService } = require("../../shared/utils/JWT");
    const tokens = JWTService.generateTokenPair({
      userId: user.userId,
      email: user.email,
      role: user.role,
      organisationId: user.organisationId,
    });

    const { password: _, ...userWithoutPassword } = user;

    res.success(
      {
        user: userWithoutPassword,
        ...tokens,
      },
      "Joined organisation successfully",
      201
    );
  }),
};

module.exports = InviteController;
