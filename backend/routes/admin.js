const express = require("express");
const {
  handleGetAdminStats,
  handleListUsers,
  handleListDoctors,
  handleListAppointments,
  handleUpdateAppointmentStatus,
  handleGetAdminDoctor,
  handleUpdateDoctorApproval,
  handleGetAdminUser,
  handleUpdateUserStatus,
} = require("../controllers/admin");
const { restrictToLoggedinUserOnly, requireRole } = require("../middlewares/auth");

const router = express.Router();

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.use(restrictToLoggedinUserOnly, requireRole("super_admin"));

router.get("/stats", handleGetAdminStats);
router.get("/users", handleListUsers);
router.get("/users/:id", handleGetAdminUser);
router.patch("/users/:id/status", handleUpdateUserStatus);
router.get("/doctors", handleListDoctors);
router.get("/doctors/:id", handleGetAdminDoctor);
router.patch("/doctors/:id/approval", handleUpdateDoctorApproval);
router.get("/appointments", handleListAppointments);
router.patch("/appointments/:id/status", handleUpdateAppointmentStatus);

module.exports = router;
