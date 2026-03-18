const express = require("express");
const UserLoginController = require("../controllers/UserLoginController");
const { authLimiter } = require("../../shared/config/RateLimit");

const router = express.Router();

// POST /auth/user/login - Login user
router.post("/login", authLimiter, UserLoginController.login);

// POST /auth/user/refresh-token - Refresh access token
router.post("/refresh-token", UserLoginController.refreshToken);

// POST /auth/user/logout - Logout user
router.post("/logout", UserLoginController.logout);

module.exports = router;
