const express = require("express");
const UserSignupController = require("../controllers/UserSignupController");
const { authLimiter } = require("../../shared/config/RateLimit");

const router = express.Router();

// POST /auth/user/signup - Register new user
router.post("/signup", authLimiter, UserSignupController.signup);

// GET /auth/user/check-email - Check if email is available
router.get("/check-email", UserSignupController.checkEmail);

module.exports = router;
