const { v4: uuidv4 } = require("uuid");
const { DynamoDBService } = require("../../shared/utils/DynamoDB");
const { TABLES, USER_ROLES } = require("../../shared/config/Constants");
const { APIError, asyncHandler } = require("../../shared/middleware/ErrorHandler");

/**
 * Organisation Controller
 */
const OrgController = {
  /**
   * Get current user's organisation
   */
  getOrganisation: asyncHandler(async (req, res) => {
    const { organisationId } = req.user;

    if (!organisationId) {
      return res.success(null);
    }

    const org = await DynamoDBService.get(TABLES.ORGANISATIONS, { orgId: organisationId });

    if (!org) {
      return res.success(null);
    }

    // Get member count
    const usersResult = await DynamoDBService.query(TABLES.USERS, {
      indexName: "OrgIndex",
      keyConditionExpression: "organisationId = :orgId",
      expressionAttributeValues: {
        ":orgId": organisationId,
      },
    });

    res.success({
      ...org,
      memberCount: usersResult.items.length,
    });
  }),

  /**
   * Create a new organisation
   */
  createOrganisation: asyncHandler(async (req, res) => {
    // req.user is populated by authenticate middleware from the JWT.
    // The JWT contains both userId and email; email is the DynamoDB partition key.
    const { userId, email } = req.user;
    const { name, domain } = req.body;

    if (!name) {
      throw new APIError("Organisation name is required", "VALIDATION_ERROR", 400);
    }

    // Check if user already has an organisation (use email — the table's partition key)
    const user = await DynamoDBService.get(TABLES.USERS, { email });
    if (user && user.organisationId) {
      throw new APIError("User already belongs to an organisation", "ALREADY_IN_ORG", 409);
    }

    const orgId = uuidv4();
    const now = new Date().toISOString();

    const org = {
      orgId,
      name,
      domain: domain || null,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      slackConnected: false,
      slackTeamId: null,
      slackTeamName: null,
    };

    await DynamoDBService.put(TABLES.ORGANISATIONS, org);

    // Update user record — use email as the partition key, set organisationId + ADMIN role
    await DynamoDBService.update(
      TABLES.USERS,
      { email },
      {
        organisationId: orgId,
        role: USER_ROLES.ADMIN,
        updatedAt: now,
      }
    );

    res.success(org, "Organisation created successfully", 201);
  }),

  /**
   * Update organisation
   */
  updateOrganisation: asyncHandler(async (req, res) => {
    const { organisationId } = req.user;
    const { name, domain } = req.body;

    if (!organisationId) {
      throw new APIError("User is not part of an organisation", "NO_ORG", 400);
    }

    const org = await DynamoDBService.get(TABLES.ORGANISATIONS, { orgId: organisationId });

    if (!org) {
      throw new APIError("Organisation not found", "NOT_FOUND", 404);
    }

    const updates = {
      updatedAt: new Date().toISOString(),
    };

    if (name) updates.name = name;
    if (domain !== undefined) updates.domain = domain;

    const updatedOrg = await DynamoDBService.update(
      TABLES.ORGANISATIONS,
      { orgId: organisationId },
      updates
    );

    res.success(updatedOrg, "Organisation updated successfully");
  }),

  /**
   * Delete organisation (admin only)
   */
  deleteOrganisation: asyncHandler(async (req, res) => {
    const { userId, organisationId, role } = req.user;

    if (!organisationId) {
      throw new APIError("User is not part of an organisation", "NO_ORG", 400);
    }

    if (role !== USER_ROLES.ADMIN) {
      throw new APIError("Only admins can delete organisations", "FORBIDDEN", 403);
    }

    const org = await DynamoDBService.get(TABLES.ORGANISATIONS, { orgId: organisationId });

    if (!org) {
      throw new APIError("Organisation not found", "NOT_FOUND", 404);
    }

    // Remove all users from organisation
    const usersResult = await DynamoDBService.query(TABLES.USERS, {
      indexName: "OrgIndex",
      keyConditionExpression: "organisationId = :orgId",
      expressionAttributeValues: {
        ":orgId": organisationId,
      },
    });

    for (const user of usersResult.items) {
      await DynamoDBService.update(
        TABLES.USERS,
        { userId: user.userId },
        {
          organisationId: null,
          role: USER_ROLES.MEMBER,
          updatedAt: new Date().toISOString(),
        }
      );
    }

    // Delete organisation
    await DynamoDBService.delete(TABLES.ORGANISATIONS, { orgId: organisationId });

    res.success(null, "Organisation deleted successfully");
  }),
};

module.exports = OrgController;
