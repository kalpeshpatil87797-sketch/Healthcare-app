const express = require("express");
const {
  handleDoctorRegistration,
  handleNearbyDoctors,
  handleUpdateAvailability,
  handleConnect,
  handleMyPatients,
  handleMyDoctors,
} = require("../controllers/doctor");
const {
  handleGetDoctorAvailability,
  handleGetMyDoctorAvailability,
  handleUpdateDoctorAvailability,
} = require("../controllers/appointment");
const { restrictToLoggedinUserOnly } = require("../middlewares/auth");

const router = express.Router();

router.post("/register", restrictToLoggedinUserOnly, handleDoctorRegistration);
router.get("/nearby", restrictToLoggedinUserOnly, handleNearbyDoctors);
router.get("/availability", restrictToLoggedinUserOnly, handleGetMyDoctorAvailability);
router.put("/availability", restrictToLoggedinUserOnly, handleUpdateDoctorAvailability);
router.patch("/availability", restrictToLoggedinUserOnly, handleUpdateAvailability);
router.get("/:id/availability", restrictToLoggedinUserOnly, handleGetDoctorAvailability);
router.post("/connect", restrictToLoggedinUserOnly, handleConnect);
router.get("/my-patients", restrictToLoggedinUserOnly, handleMyPatients);
router.get("/my-doctors", restrictToLoggedinUserOnly, handleMyDoctors);

module.exports = router;