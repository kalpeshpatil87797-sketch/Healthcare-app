const express = require("express");
const {
  handleUserSignup,
  handleUserLogin,
  handleLeaveDoctorRole,
  handleForgotPassword,
  handleResetPassword,
  handleGetProfile,
  handleUpdateProfile,
  handleGeocodeClinicLocation,
  handleReverseGeocodeLocation,
  handleUpdateLocation,
} = require("../controllers/user");
const { restrictToLoggedinUserOnly } = require("../middlewares/auth");
const rateLimit = require("express-rate-limit");

const authLimiter = require("../middlewares/rateLimiter");
const locationLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many location lookups. Please try again later." },
});

const router = express.Router();

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.post("/signup", handleUserSignup);
router.post("/login",authLimiter, handleUserLogin);
router.post("/doctor/leave", restrictToLoggedinUserOnly, handleLeaveDoctorRole);
router.post("/forgot-password", handleForgotPassword);
router.post("/reset-password/:token", handleResetPassword);
router.get("/me", restrictToLoggedinUserOnly, handleGetProfile);
router.put("/me", restrictToLoggedinUserOnly, handleUpdateProfile);
router.post(
  "/clinic-location/geocode",
  restrictToLoggedinUserOnly,
  locationLookupLimiter,
  handleGeocodeClinicLocation
);
router.post("/location/reverse-geocode", locationLookupLimiter, handleReverseGeocodeLocation);
router.put("/location", restrictToLoggedinUserOnly, handleUpdateLocation);

module.exports = router;