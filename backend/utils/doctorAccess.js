const Doctor = require("../models/doctor");
const User = require("../models/user");

const DOCTOR_APPLICATION_ROLES = ["patient", "doctor"];

function canSubmitDoctorApplication(role) {
  return DOCTOR_APPLICATION_ROLES.includes(role);
}

function isDoctorApproved(doctor) {
  return Boolean(doctor) &&
    doctor.isActive !== false &&
    (doctor.approvalStatus == null || doctor.approvalStatus === "approved");
}

function getEffectiveDoctorRole(role, doctor) {
  return role === "doctor" && !isDoctorApproved(doctor) ? "patient" : role;
}

function canManageDoctorAvailability(user, doctor) {
  return user?.role === "doctor" &&
    user.accountStatus !== "suspended" &&
    isDoctorApproved(doctor);
}

async function getEffectiveRole(userEmail) {
  const user = await User.findOne({ email: userEmail })
    .select("role accountStatus")
    .lean();
  if (!user || user.accountStatus === "suspended") return null;
  if (user.role !== "doctor") return user.role;

  const doctor = await Doctor.findOne({ registeredBy: userEmail })
    .select("approvalStatus isActive")
    .lean();
  return getEffectiveDoctorRole(user.role, doctor);
}

async function getAuthorizedDoctor(userEmail) {
  const user = await User.findOne({ email: userEmail })
    .select("role accountStatus")
    .lean();
  if (!user || user.role !== "doctor" || user.accountStatus === "suspended") {
    return null;
  }

  const doctor = await Doctor.findOne({ registeredBy: userEmail }).lean();
  return canManageDoctorAvailability(user, doctor) ? doctor : null;
}

module.exports = {
  DOCTOR_APPLICATION_ROLES,
  canSubmitDoctorApplication,
  canManageDoctorAvailability,
  getEffectiveRole,
  getAuthorizedDoctor,
  isDoctorApproved,
  getEffectiveDoctorRole,
};
