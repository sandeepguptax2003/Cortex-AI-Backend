const { DynamoDBService } = require("../../shared/utils/DynamoDB");
const { S3Service } = require("../../shared/utils/S3");
const { TABLES, S3_CONFIG } = require("../../shared/config/Constants");
const { APIError, asyncHandler } = require("../../shared/middleware/ErrorHandler");

/**
 * User Profile Controller
 * NOTE: The USERS table uses `email` as the partition key.
 * The JWT contains both `userId` and `email`, so we use `email`
 * directly for all DynamoDB operations instead of querying by UserIdIndex GSI.
 */
const UserProfileController = {
  /**
   * Get current user profile
   */
  getProfile: asyncHandler(async (req, res) => {
    const { email } = req.user;

    const user = await DynamoDBService.get(TABLES.USERS, { email });

    if (!user) {
      throw new APIError("User not found", "USER_NOT_FOUND", 404);
    }

    const { password, ...userWithoutPassword } = user;
    res.success(userWithoutPassword);
  }),

  /**
   * Update user profile
   */
  updateProfile: asyncHandler(async (req, res) => {
    const { email } = req.user;
    const { name, slackUserId, notificationPreferences } = req.body;

    const user = await DynamoDBService.get(TABLES.USERS, { email });

    if (!user) {
      throw new APIError("User not found", "USER_NOT_FOUND", 404);
    }

    // Email is the DynamoDB partition key and cannot be updated — ignore any email changes
    const updates = {
      updatedAt: new Date().toISOString(),
    };

    if (name) updates.name = name;
    // email is intentionally excluded — it is the DynamoDB partition key
    if (slackUserId !== undefined) updates.slackUserId = slackUserId;
    if (notificationPreferences) {
      updates.notificationPreferences = {
        ...user.notificationPreferences,
        ...notificationPreferences,
      };
    }

    const updatedUser = await DynamoDBService.update(TABLES.USERS, { email }, updates);

    const { password, ...userWithoutPassword } = updatedUser;
    res.success(userWithoutPassword, "Profile updated successfully");
  }),

  /**
   * Update password
   */
  updatePassword: asyncHandler(async (req, res) => {
    const { email } = req.user;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new APIError("Current password and new password are required", "VALIDATION_ERROR", 400);
    }

    if (newPassword.length < 8) {
      throw new APIError("New password must be at least 8 characters long", "VALIDATION_ERROR", 400);
    }

    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumbers = /\d/.test(newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      throw new APIError(
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
        "VALIDATION_ERROR",
        400
      );
    }

    const user = await DynamoDBService.get(TABLES.USERS, { email });

    if (!user) {
      throw new APIError("User not found", "USER_NOT_FOUND", 404);
    }

    if (user.password !== currentPassword) {
      throw new APIError("Current password is incorrect", "INVALID_PASSWORD", 401);
    }

    await DynamoDBService.update(TABLES.USERS, { email }, {
      password: newPassword,
      updatedAt: new Date().toISOString(),
    });

    res.success(null, "Password updated successfully");
  }),

  /**
   * Upload profile picture
   */
  uploadProfilePicture: asyncHandler(async (req, res) => {
    const { userId, email } = req.user;

    if (!req.file) {
      throw new APIError("No file uploaded", "NO_FILE", 400);
    }

    if (req.file.size > S3_CONFIG.maxFileSize) {
      throw new APIError("File size exceeds 5MB limit", "FILE_TOO_LARGE", 400);
    }

    const user = await DynamoDBService.get(TABLES.USERS, { email });

    if (!user) {
      throw new APIError("User not found", "USER_NOT_FOUND", 404);
    }

    // Delete old avatar from S3 if exists
    if (user.avatar) {
      try {
        const oldKey = S3Service.extractKeyFromUrl(user.avatar);
        if (oldKey) {
          await S3Service.deleteFile(oldKey);
        }
      } catch {
        // Ignore old avatar deletion errors
      }
    }

    // Upload new avatar
    const avatarUrl = await S3Service.uploadProfilePicture(
      req.file.buffer,
      userId,
      req.file.mimetype
    );

    // Update user with new avatar URL
    const updatedUser = await DynamoDBService.update(TABLES.USERS, { email }, {
      avatar: avatarUrl,
      updatedAt: new Date().toISOString(),
    });

    const { password, ...userWithoutPassword } = updatedUser;

    // Return full updated user so the frontend can update local state
    res.success({ ...userWithoutPassword, avatarUrl }, "Profile picture updated successfully");
  }),

  /**
   * Delete user account
   */
  deleteAccount: asyncHandler(async (req, res) => {
    const { email } = req.user;

    const user = await DynamoDBService.get(TABLES.USERS, { email });

    if (!user) {
      throw new APIError("User not found", "USER_NOT_FOUND", 404);
    }

    if (user.avatar) {
      try {
        const key = S3Service.extractKeyFromUrl(user.avatar);
        if (key) {
          await S3Service.deleteFile(key);
        }
      } catch {
        // Ignore avatar deletion errors
      }
    }

    await DynamoDBService.delete(TABLES.USERS, { email });

    res.success(null, "Account deleted successfully");
  }),
};

module.exports = UserProfileController;
