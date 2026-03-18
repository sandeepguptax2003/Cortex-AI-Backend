const express = require("express");
const InviteController = require("../controllers/InviteController");
const { authenticate, adminOrManager } = require("../../auth/middleware/AuthMiddleware");
const { inviteLimiter } = require("../middleware/AdminRateLimit");

const router = express.Router();

// Public routes (no auth required)
router.get("/invite/validate", InviteController.validateInvite);
router.post("/join", InviteController.joinOrganisation);

// Protected routes (auth required)
router.use(authenticate);
router.use(inviteLimiter);

// POST /admin/invites - Create invite (admin/manager only)
router.post(
  "/invites",
  adminOrManager,
  InviteController.createInvite
);

// GET /admin/invites - Get invites (admin/manager only)
router.get(
  "/invites",
  adminOrManager,
  InviteController.getInvites
);

// DELETE /admin/invites/:token - Revoke invite (admin/manager only)
router.delete(
  "/invites/:token",
  adminOrManager,
  InviteController.revokeInvite
);

module.exports = router;
