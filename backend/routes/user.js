const express = require("express");
const {
  handleUserSignup,
  handleUserLogin,
  handleForgotPassword,
  handleResetPassword,
} = require("../controllers/user");

const authLimiter = require("../middlewares/rateLimiter");

const router = express.Router();

router.post("/signup", handleUserSignup);
router.post("/login",authLimiter, handleUserLogin);
router.post("/forgot-password", handleForgotPassword);
router.post("/reset-password/:token", handleResetPassword);

module.exports = router;