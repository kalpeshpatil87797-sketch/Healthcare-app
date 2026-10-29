const express = require("express");
const {
  handleGetAdminStats,
  handleListUsers,
  handleListDoctors,
  handleListAppointments,
  handleUpdateAppointmentStatus,
  handleGetAdminDoctor,
  handleUpdateDoctorApproval,
  handleRemoveDoctor,
  handleGetAdminUser,
  handleUpdateUserStatus,
  handleUpdateUserRole,
} = require("../controllers/admin");
const { restrictToLoggedinUserOnly, requireRole } = require("../middlewares/auth");
const { ADMIN_DASHBOARD_ROLES } = require("../utils/adminAccess");

const router = express.Router();

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.use(restrictToLoggedinUserOnly, requireRole("root_owner", "admin"));

router.get("/stats", handleGetAdminStats);
router.get("/users", handleListUsers);
router.get("/users/:id", handleGetAdminUser);
router.patch("/users/:id/status", handleUpdateUserStatus);
router.patch("/users/:id/role", requireRole("root_owner"), handleUpdateUserRole);
router.get("/doctors", handleListDoctors);
router.get("/doctors/:id", handleGetAdminDoctor);
router.patch("/doctors/:id/approval", handleUpdateDoctorApproval);
router.patch("/doctors/:id/remove", handleRemoveDoctor);
router.get("/appointments", handleListAppointments);
router.patch("/appointments/:id/status", handleUpdateAppointmentStatus);

module.exports = router;
