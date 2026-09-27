const express = require("express");
const {
  handleBookAppointment,
  handleMyAppointments,
  handleDoctorAppointments,
  handleRespondAppointment,
  handleCancelAppointment,
  handleAcceptAlternate,
} = require("../controllers/appointment");
const { restrictToLoggedinUserOnly } = require("../middlewares/auth");

const router = express.Router();

router.post("/book", restrictToLoggedinUserOnly, handleBookAppointment);
router.get("/mine", restrictToLoggedinUserOnly, handleMyAppointments);
router.get("/doctor", restrictToLoggedinUserOnly, handleDoctorAppointments);
router.patch("/:id/respond", restrictToLoggedinUserOnly, handleRespondAppointment);
router.patch("/:id/cancel", restrictToLoggedinUserOnly, handleCancelAppointment);
router.patch("/:id/accept-alternate", restrictToLoggedinUserOnly, handleAcceptAlternate);

module.exports = router;
