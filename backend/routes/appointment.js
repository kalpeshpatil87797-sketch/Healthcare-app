const express = require("express");
const {
  handleBookAppointment,
  handleAppointmentAvailability,
  handleMyAppointments,
  handleDoctorAppointments,
  handleRespondAppointment,
  handleCancelAppointment,
  handleRescheduleAppointment,
  handleCompleteAppointment,
  handleAcceptAlternate,
} = require("../controllers/appointment");
const { restrictToLoggedinUserOnly } = require("../middlewares/auth");

const router = express.Router();

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.post("/book", restrictToLoggedinUserOnly, handleBookAppointment);
router.get("/availability", restrictToLoggedinUserOnly, handleAppointmentAvailability);
router.get("/mine", restrictToLoggedinUserOnly, handleMyAppointments);
router.get("/doctor", restrictToLoggedinUserOnly, handleDoctorAppointments);
router.patch("/:id/respond", restrictToLoggedinUserOnly, handleRespondAppointment);
router.patch("/:id/cancel", restrictToLoggedinUserOnly, handleCancelAppointment);
router.patch("/:id/reschedule", restrictToLoggedinUserOnly, handleRescheduleAppointment);
router.patch("/:id/complete", restrictToLoggedinUserOnly, handleCompleteAppointment);
router.patch("/:id/accept-alternate", restrictToLoggedinUserOnly, handleAcceptAlternate);

module.exports = router;
