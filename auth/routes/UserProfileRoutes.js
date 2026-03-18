const express = require("express");
const multer = require("multer");
const UserProfileController = require("../controllers/UserProfileController");
const { authenticate } = require("../middleware/AuthMiddleware");
const { profileLimiter } = require("../../user/middleware/UserRateLimit");

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// All routes require authentication
router.use(authenticate);
router.use(profileLimiter);

// GET /auth/user/profile - Get user profile
router.get("/profile", UserProfileController.getProfile);

// PATCH /auth/user/profile - Update user profile
router.patch("/profile", UserProfileController.updateProfile);

// PATCH /auth/user/password - Update password
router.patch("/password", UserProfileController.updatePassword);

// POST /auth/user/profile-picture - Upload profile picture
router.post(
  "/profile-picture",
  upload.single("file"),
  UserProfileController.uploadProfilePicture
);

// DELETE /auth/user/account - Delete account
router.delete("/account", UserProfileController.deleteAccount);

module.exports = router;
