const express = require("express");
const {
  handleUserSignup,
  handleUserLogin,
  handleForgotPassword,
  handleResetPassword,
} = require("../controllers/user");

const router = express.Router();

router.post("/signup", handleUserSignup);
router.post("/login", handleUserLogin);
router.post("/forgot-password", handleForgotPassword);
router.post("/reset-password/:token", handleResetPassword);

module.exports = router;