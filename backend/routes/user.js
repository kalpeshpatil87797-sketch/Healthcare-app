const express = require("express");
const {
  handleUserSignup,
  handleUserLogin,
  handleForgotPassword,
  handleResetPassword,
  handleGetProfile,
  handleUpdateLocation,
} = require("../controllers/user");
const { restrictToLoggedinUserOnly } = require("../middlewares/auth");

const authLimiter = require("../middlewares/rateLimiter");

const router = express.Router();

router.post("/signup", handleUserSignup);
router.post("/login",authLimiter, handleUserLogin);
router.post("/forgot-password", handleForgotPassword);
router.post("/reset-password/:token", handleResetPassword);
router.get("/me", restrictToLoggedinUserOnly, handleGetProfile);
router.put("/location", restrictToLoggedinUserOnly, handleUpdateLocation);

module.exports = router;