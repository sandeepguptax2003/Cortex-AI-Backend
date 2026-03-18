const { v4: uuidv4 } = require("uuid");
const { DynamoDBService } = require("../../shared/utils/DynamoDB");
const { TABLES } = require("../../shared/config/Constants");
const { APIError, asyncHandler } = require("../../shared/middleware/ErrorHandler");

/**
 * Notification Controller
 */
const NotificationController = {
  /**
   * Get user's notifications
   */
  getNotifications: asyncHandler(async (req, res) => {
    const { userId } = req.user;
    const { unreadOnly } = req.query;

    let filterExpression = undefined;
    let expressionAttributeValues = {
      ":userId": userId,
    };

    if (unreadOnly === "true") {
      filterExpression = "isRead = :isRead";
      expressionAttributeValues[":isRead"] = false;
    }

    const result = await DynamoDBService.query(TABLES.NOTIFICATIONS, {
      indexName: "UserIndex",
      keyConditionExpression: "userId = :userId",
      filterExpression,
      expressionAttributeValues,
    });

    const notifications = result.items.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.success(notifications);
  }),

  /**
   * Mark notification as read
   */
  markAsRead: asyncHandler(async (req, res) => {
    const { notificationId } = req.params;
    const { userId } = req.user;

    const notification = await DynamoDBService.get(TABLES.NOTIFICATIONS, {
      notificationId,
    });

    if (!notification) {
      throw new APIError("Notification not found", "NOT_FOUND", 404);
    }

    if (notification.userId !== userId) {
      throw new APIError("Access denied", "FORBIDDEN", 403);
    }

    const updated = await DynamoDBService.update(
      TABLES.NOTIFICATIONS,
      { notificationId },
      {
        isRead: true,
        readAt: new Date().toISOString(),
      }
    );

    res.success(updated);
  }),

  /**
   * Mark all notifications as read
   */
  markAllAsRead: asyncHandler(async (req, res) => {
    const { userId } = req.user;

    const result = await DynamoDBService.query(TABLES.NOTIFICATIONS, {
      indexName: "UserIndex",
      keyConditionExpression: "userId = :userId",
      filterExpression: "isRead = :isRead",
      expressionAttributeValues: {
        ":userId": userId,
        ":isRead": false,
      },
    });

    const now = new Date().toISOString();

    // Update all unread notifications
    for (const notification of result.items) {
      await DynamoDBService.update(
        TABLES.NOTIFICATIONS,
        { notificationId: notification.notificationId },
        {
          isRead: true,
          readAt: now,
        }
      );
    }

    res.success(null, "All notifications marked as read");
  }),

  /**
   * Create a notification (internal use)
   */
  async createNotification({ userId, type, title, message, data = {} }) {
    const notification = {
      notificationId: uuidv4(),
      userId,
      type,
      title,
      message,
      data,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    await DynamoDBService.put(TABLES.NOTIFICATIONS, notification);
    return notification;
  },
};

module.exports = NotificationController;
