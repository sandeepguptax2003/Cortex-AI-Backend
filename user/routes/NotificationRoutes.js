const express = require("express");
const NotificationController = require("../controllers/NotificationController");
const { authenticate } = require("../../auth/middleware/AuthMiddleware");
const { notificationLimiter } = require("../middleware/UserRateLimit");

const router = express.Router();

// All notification routes require authentication
router.use(authenticate);
router.use(notificationLimiter);

// GET /user/notifications - Get notifications
router.get("/notifications", NotificationController.getNotifications);

// PATCH /user/notifications/:notificationId/read - Mark as read
router.patch("/notifications/:notificationId/read", NotificationController.markAsRead);

// PATCH /user/notifications/read-all - Mark all as read
router.patch("/notifications/read-all", NotificationController.markAllAsRead);

module.exports = router;
