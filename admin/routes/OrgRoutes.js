const express = require("express");
const OrgController = require("../controllers/OrgController");
const { authenticate, adminOnly, adminOrManager } = require("../../auth/middleware/AuthMiddleware");
const { orgLimiter } = require("../middleware/AdminRateLimit");

const router = express.Router();

// All org routes require authentication (even create — user must be logged in)
router.use(authenticate);
router.use(orgLimiter);

// POST /admin/organisation - Create organisation
router.post("/organisation", OrgController.createOrganisation);

// GET /admin/organisation - Get organisation
router.get("/organisation", OrgController.getOrganisation);

// PATCH /admin/organisation - Update organisation (admin/manager only)
router.patch(
  "/organisation",
  adminOrManager,
  OrgController.updateOrganisation
);

// DELETE /admin/organisation - Delete organisation (admin only)
router.delete(
  "/organisation",
  adminOnly,
  OrgController.deleteOrganisation
);

module.exports = router;
