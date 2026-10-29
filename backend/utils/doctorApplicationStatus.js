function normalizeDoctorApplicationStatus(value) {
  return value === "pending" || value === "rejected" ? value : "approved";
}

function isApprovedDoctorProfile(application) {
  return Boolean(application) &&
    application.isActive !== false &&
    normalizeDoctorApplicationStatus(application.approvalStatus) === "approved";
}

function isBlockingDoctorApplication(application) {
  if (!application) return false;
  const status = normalizeDoctorApplicationStatus(application?.approvalStatus);
  return status === "pending" ||
    (status === "approved" && application?.isActive !== false);
}

function canReapplyForDoctorProfile(application) {
  if (!application) return false;
  const status = normalizeDoctorApplicationStatus(application.approvalStatus);
  return status === "rejected" ||
    (status === "approved" && application.isActive === false);
}

function buildDoctorReapplicationUpdate(fields, submittedAt) {
  return {
    $set: {
      ...fields,
      isActive: true,
      approvalStatus: "pending",
      submittedAt,
    },
    $unset: {
      rejectionReason: "",
      reviewedBy: "",
      reviewedAt: "",
    },
  };
}

module.exports = {
  buildDoctorReapplicationUpdate,
  canReapplyForDoctorProfile,
  isApprovedDoctorProfile,
  isBlockingDoctorApplication,
  normalizeDoctorApplicationStatus,
};
