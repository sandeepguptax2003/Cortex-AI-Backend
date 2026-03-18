const express = require("express");
const AnalyticsController = require("../controllers/AnalyticsController");
const { authenticate } = require("../../auth/middleware/AuthMiddleware");
const { analyticsLimiter } = require("../middleware/AdminRateLimit");

const router = express.Router();

// All analytics routes require authentication
router.use(authenticate);
router.use(analyticsLimiter);

// GET /admin/analytics/dashboard - Get dashboard analytics
router.get("/analytics/dashboard", AnalyticsController.getDashboardAnalytics);

// GET /admin/analytics/detailed - Get detailed analytics
router.get("/analytics/detailed", AnalyticsController.getDetailedAnalytics);

// GET /admin/analytics/trends - Get ticket trends
router.get("/analytics/trends", AnalyticsController.getTicketTrends);

module.exports = router;
