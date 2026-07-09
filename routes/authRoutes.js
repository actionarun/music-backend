const express = require("express");
const router = express.Router();
const {
  signup,
  verifyEmail,
  login,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

router.post("/signup", signup);
router.get("/verify-email/:token", verifyEmail);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:token", resetPassword);
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);

module.exports = router;