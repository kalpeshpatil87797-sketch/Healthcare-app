const test = require("node:test");
const assert = require("node:assert/strict");
const {
  canManageDoctorAvailability,
  canSubmitDoctorApplication,
  getEffectiveDoctorRole,
  isDoctorApproved,
} = require("../utils/doctorAccess");
const { canAccessAdminDashboard } = require("../utils/adminAccess");

test("only approved doctor profiles receive the effective doctor role", () => {
  assert.equal(getEffectiveDoctorRole("doctor", { approvalStatus: "approved" }), "doctor");
  assert.equal(getEffectiveDoctorRole("doctor", { approvalStatus: undefined }), "doctor");
  assert.equal(getEffectiveDoctorRole("doctor", { approvalStatus: "pending" }), "patient");
  assert.equal(getEffectiveDoctorRole("doctor", { approvalStatus: "rejected" }), "patient");
  assert.equal(getEffectiveDoctorRole("doctor", { approvalStatus: "removed" }), "patient");
  assert.equal(getEffectiveDoctorRole("doctor", null), "patient");
  assert.equal(getEffectiveDoctorRole("patient", null), "patient");
  assert.equal(getEffectiveDoctorRole("super_admin", null), "super_admin");
});

test("doctor application cannot demote privileged account roles", () => {
  assert.equal(canSubmitDoctorApplication("patient"), true);
  assert.equal(canSubmitDoctorApplication("doctor"), true);
  assert.equal(canSubmitDoctorApplication("admin"), false);
  assert.equal(canSubmitDoctorApplication("root_owner"), false);
  assert.equal(canSubmitDoctorApplication("super_admin"), false);
});

test("doctor application status does not rewrite privileged effective roles", () => {
  for (const role of ["admin", "root_owner", "super_admin"]) {
    for (const approvalStatus of ["pending", "rejected"]) {
      assert.equal(
        getEffectiveDoctorRole(role, { approvalStatus }),
        role,
        `${role} must remain unchanged for ${approvalStatus} doctor profiles`
      );
    }
  }
  for (const approvalStatus of ["pending", "rejected"]) {
    assert.equal(
      getEffectiveDoctorRole("doctor", { approvalStatus }),
      "patient"
    );
  }
});

test("only Root Owner and legacy Super Admin roles can access the admin dashboard", () => {
  assert.equal(canAccessAdminDashboard("root_owner"), true);
  assert.equal(canAccessAdminDashboard("super_admin"), true);
  assert.equal(canAccessAdminDashboard("admin"), false);
  assert.equal(canAccessAdminDashboard("doctor"), false);
  assert.equal(canAccessAdminDashboard("patient"), false);
});

test("legacy profiles remain eligible but unknown approval states fail closed", () => {
  assert.equal(isDoctorApproved({}), true);
  assert.equal(isDoctorApproved({ approvalStatus: "approved" }), true);
  assert.equal(isDoctorApproved({ approvalStatus: "suspended" }), false);
  assert.equal(isDoctorApproved(null), false);
});

test("only active approved doctors can manage appointment availability", () => {
  const approvedDoctor = { approvalStatus: "approved" };
  assert.equal(
    canManageDoctorAvailability({ role: "doctor", accountStatus: "active" }, approvedDoctor),
    true
  );
  assert.equal(
    canManageDoctorAvailability({ role: "doctor" }, { approvalStatus: null }),
    true
  );
  for (const role of ["patient", "admin", "root_owner", "super_admin"]) {
    assert.equal(
      canManageDoctorAvailability({ role, accountStatus: "active" }, approvedDoctor),
      false,
      `${role} must not manage doctor availability`
    );
  }
  assert.equal(
    canManageDoctorAvailability(
      { role: "doctor", accountStatus: "suspended" },
      approvedDoctor
    ),
    false
  );
  for (const approvalStatus of ["pending", "rejected", "removed"]) {
    assert.equal(
      canManageDoctorAvailability(
        { role: "doctor", accountStatus: "active" },
        { approvalStatus }
      ),
      false,
      `${approvalStatus} applicants must not manage availability`
    );
  }
});
