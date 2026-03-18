const express = require("express");
const TeamController = require("../controllers/TeamController");
const { authenticate, adminOnly } = require("../../auth/middleware/AuthMiddleware");
const { teamLimiter } = require("../middleware/AdminRateLimit");

const router = express.Router();

// All team routes require authentication
router.use(authenticate);
router.use(teamLimiter);

// GET /admin/members - Get team members
router.get("/members", TeamController.getMembers);

// GET /admin/members/stats - Get team stats
router.get("/members/stats", TeamController.getStats);

// PATCH /admin/members/:userId/role - Update member role (admin only)
router.patch(
  "/members/:userId/role",
  adminOnly,
  TeamController.updateMemberRole
);

// DELETE /admin/members/:userId - Remove member (admin only)
router.delete(
  "/members/:userId",
  adminOnly,
  TeamController.removeMember
);

module.exports = router;
