const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildDoctorReapplicationUpdate,
  canReapplyForDoctorProfile,
  isApprovedDoctorProfile,
  isBlockingDoctorApplication,
  normalizeDoctorApplicationStatus,
} = require("../utils/doctorApplicationStatus");

test("legacy profiles remain approved unless explicitly inactive", () => {
  const legacyActive = { isActive: true };
  const legacyRemoved = { isActive: false };

  assert.equal(normalizeDoctorApplicationStatus(undefined), "approved");
  assert.equal(isApprovedDoctorProfile(legacyActive), true);
  assert.equal(isBlockingDoctorApplication(legacyActive), true);
  assert.equal(canReapplyForDoctorProfile(legacyActive), false);
  assert.equal(isApprovedDoctorProfile(legacyRemoved), false);
  assert.equal(canReapplyForDoctorProfile(legacyRemoved), true);
});

test("approved then removed can be reapplied as pending with stale review fields cleared", () => {
  const approved = { approvalStatus: "approved", isActive: true };
  assert.equal(isApprovedDoctorProfile(approved), true);
  assert.equal(canReapplyForDoctorProfile(approved), false);

  const removed = { ...approved, isActive: false };
  assert.equal(isApprovedDoctorProfile(removed), false);
  assert.equal(canReapplyForDoctorProfile(removed), true);

  const submittedAt = new Date("2026-10-28T07:59:00.000Z");
  const update = buildDoctorReapplicationUpdate(
    { name: "Updated application", registeredBy: "doctor@example.test" },
    submittedAt
  );
  const pending = {
    ...removed,
    rejectionReason: "stale",
    reviewedBy: "old reviewer",
    reviewedAt: new Date("2025-01-01T00:00:00.000Z"),
    ...update.$set,
  };
  Object.keys(update.$unset).forEach((field) => delete pending[field]);

  assert.equal(pending.approvalStatus, "pending");
  assert.equal(pending.isActive, true);
  assert.equal(pending.submittedAt, submittedAt);
  assert.equal(isApprovedDoctorProfile(pending), false);
  assert.equal(isBlockingDoctorApplication(pending), true);
  assert.deepEqual(Object.keys(update.$unset).sort(), [
    "rejectionReason",
    "reviewedAt",
    "reviewedBy",
  ]);
});

test("pending applications become active only after review approval; rejection stays non-doctor", () => {
  const pending = { approvalStatus: "pending", isActive: true };
  assert.equal(isApprovedDoctorProfile(pending), false);
  assert.equal(canReapplyForDoctorProfile(pending), false);

  const approved = { ...pending, approvalStatus: "approved" };
  assert.equal(isApprovedDoctorProfile(approved), true);

  const rejected = { ...pending, approvalStatus: "rejected" };
  assert.equal(isApprovedDoctorProfile(rejected), false);
  assert.equal(canReapplyForDoctorProfile(rejected), true);
});
