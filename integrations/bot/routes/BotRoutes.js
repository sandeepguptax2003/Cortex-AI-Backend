const express = require("express");
const BotController = require("../controllers/BotController");
const { authenticate } = require("../../../auth/middleware/AuthMiddleware");

const router = express.Router();

// Public routes
router.get("/status", BotController.getStatus);

// Protected routes
router.use(authenticate);
router.post("/command", BotController.processCommand);

module.exports = router;
