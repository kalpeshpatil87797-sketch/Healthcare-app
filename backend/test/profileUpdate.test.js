const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../models/user");
const Doctor = require("../models/doctor");
const userRoutes = require("../routes/user");
const { handleUpdateProfile } = require("../controllers/user");
const { restrictToLoggedinUserOnly } = require("../middlewares/auth");
const { buildProfileUpdate } = require("../utils/profileUpdate");

const patient = {
  _id: "patient-id",
  email: "patient@example.test",
  role: "patient",
  accountStatus: "active",
};

const pendingDoctor = {
  _id: "doctor-profile-id",
  registeredBy: patient.email,
  name: "Dr Ada",
  clinicLocation: "Old clinic address",
  location: { type: "Point", coordinates: [73.8, 18.5] },
  locationVerified: true,
  approvalStatus: "pending",
  isActive: true,
};

test("valid patient updates include only supported personal fields", () => {
  const result = buildProfileUpdate(
    { name: "  Ada Patient ", age: "35", phone: "9876543210", address: "Pune" },
    patient,
    null
  );

  assert.deepEqual(result.userUpdate, {
    $set: { name: "Ada Patient", age: 35, phone: "9876543210", address: "Pune" },
  });
  assert.equal(result.doctorUpdate, null);
});

test("pending doctor applicant can update their own professional fields without changing status", () => {
  const result = buildProfileUpdate(
    { name: "Dr Ada Updated", clinicName: "New Clinic", degree: "MBBS", specialist: "Cardiology" },
    patient,
    pendingDoctor
  );

  assert.deepEqual(result.userUpdate, { $set: { name: "Dr Ada Updated" } });
  assert.deepEqual(result.doctorUpdate, {
    $set: { name: "Dr Ada Updated", clinicName: "New Clinic", degree: "MBBS", specialist: "Cardiology" },
  });
  assert.equal(result.doctorProfileEditable, true);
  assert.equal(result.doctorUpdate.$set.approvalStatus, undefined);
  assert.equal(result.doctorUpdate.$set.registeredBy, undefined);
});

test("invalid personal details and partial or out-of-range clinic coordinates are rejected", () => {
  assert.equal(buildProfileUpdate({ age: 0 }, patient, null).status, 400);
  assert.equal(buildProfileUpdate({ phone: "not a phone" }, patient, null).status, 400);
  assert.equal(
    buildProfileUpdate({ clinicLatitude: 91 }, patient, pendingDoctor).status,
    400
  );
  assert.equal(
    buildProfileUpdate({ clinicLatitude: 18.5 }, patient, pendingDoctor).status,
    400
  );
  assert.equal(
    buildProfileUpdate(
      { clinicLatitude: null, clinicLongitude: null },
      patient,
      pendingDoctor
    ).status,
    400
  );
});

test("protected-field tampering is rejected and patient cannot edit doctor-only fields without an application", () => {
  assert.equal(buildProfileUpdate({ role: "admin" }, patient, null).status, 400);
  assert.equal(buildProfileUpdate({ locationVerified: true }, patient, pendingDoctor).status, 400);
  assert.equal(buildProfileUpdate({ clinicName: "Changed" }, patient, null).status, 403);
  assert.equal(
    buildProfileUpdate(
      { clinicName: "Changed" },
      { ...patient, role: "admin" },
      pendingDoctor
    ).status,
    403
  );
});

test("changing clinic address or coordinates revokes verification; address-only edits discard stale coordinates", () => {
  const addressChange = buildProfileUpdate(
    { clinicLocation: "New clinic address" },
    patient,
    pendingDoctor
  );
  assert.equal(addressChange.doctorUpdate.$set.locationVerified, false);
  assert.deepEqual(addressChange.doctorUpdate.$unset, { location: "" });

  const coordinateChange = buildProfileUpdate(
    { clinicLatitude: 19, clinicLongitude: 74 },
    patient,
    pendingDoctor
  );
  assert.equal(coordinateChange.doctorUpdate.$set.locationVerified, false);
  assert.deepEqual(coordinateChange.doctorUpdate.$set.location, {
    type: "Point",
    coordinates: [74, 19],
  });
});

test("profile update route is authenticated and targets the session user, not a body-supplied identity", async (t) => {
  const route = userRoutes.stack.find(
    (layer) => layer.route?.path === "/me" && layer.route.methods.put
  );
  assert.ok(route);
  assert.equal(route.route.stack[0].handle, restrictToLoggedinUserOnly);
  assert.equal(route.route.stack[1].handle, handleUpdateProfile);

  let userQuery;
  t.mock.method(User, "findById", (id) => {
    userQuery = id;
    return {
      select() { return this; },
      async lean() { return patient; },
    };
  });
  t.mock.method(Doctor, "findOne", () => ({
    select() { return this; },
    sort() { return this; },
    async lean() { return null; },
  }));
  t.mock.method(User, "findOneAndUpdate", () => ({
    select() { return this; },
    then(resolve) { return Promise.resolve({ _id: patient._id }).then(resolve); },
  }));
  const response = createResponse();
  await handleUpdateProfile(
    {
      user: { _id: "authenticated-user-id", email: "attacker@example.test" },
      body: { name: "Updated", userId: "another-user-id" },
    },
    response
  );

  assert.equal(userQuery, "authenticated-user-id");
  assert.equal(response.statusCode, 400);
});

test("authenticated patient profile update persists only the current user's own fields", async (t) => {
  const updates = [];
  t.mock.method(User, "findById", () => ({
    select() { return this; },
    async lean() { return patient; },
  }));
  t.mock.method(User, "findOneAndUpdate", (query, update) => {
    updates.push({ query, update });
    return { select: async () => ({ _id: patient._id }) };
  });
  t.mock.method(Doctor, "findOne", () => ({
    select() { return this; },
    sort() { return this; },
    async lean() { return null; },
  }));

  const response = createResponse();
  await handleUpdateProfile(
    {
      user: { _id: patient._id, email: patient.email },
      body: { phone: "9876543210" },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(updates, [{
    query: { _id: patient._id, accountStatus: { $ne: "suspended" } },
    update: { $set: { phone: "9876543210" } },
  }]);
});

test("authenticated doctor address edit persists coordinate removal and verification revocation", async (t) => {
  const doctorRoleUser = { ...patient, role: "doctor" };
  let savedDoctorUpdate;
  t.mock.method(User, "findById", () => ({
    select() { return this; },
    async lean() { return doctorRoleUser; },
  }));
  t.mock.method(Doctor, "findOne", () => ({
    select() { return this; },
    sort() { return this; },
    async lean() { return { ...pendingDoctor, approvalStatus: "approved" }; },
  }));
  t.mock.method(Doctor, "findOneAndUpdate", (query, update) => {
    assert.equal(query.registeredBy, patient.email);
    savedDoctorUpdate = update;
    return { select: async () => ({ _id: pendingDoctor._id }) };
  });

  const response = createResponse();
  await handleUpdateProfile(
    {
      user: { _id: patient._id, email: patient.email },
      body: { clinicLocation: "Corrected clinic address" },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(savedDoctorUpdate.$set.locationVerified, false);
  assert.deepEqual(savedDoctorUpdate.$unset, { location: "" });
});

test("authenticated doctor coordinate update stores GeoJSON longitude-latitude and revokes verification", async (t) => {
  const doctorRoleUser = { ...patient, role: "doctor" };
  let savedDoctorUpdate;
  t.mock.method(User, "findById", () => ({
    select() { return this; },
    async lean() { return doctorRoleUser; },
  }));
  t.mock.method(Doctor, "findOne", () => ({
    select() { return this; },
    sort() { return this; },
    async lean() { return { ...pendingDoctor, approvalStatus: "approved" }; },
  }));
  t.mock.method(Doctor, "findOneAndUpdate", (query, update) => {
    assert.equal(query._id, pendingDoctor._id);
    savedDoctorUpdate = update;
    return { select: async () => ({ _id: pendingDoctor._id }) };
  });

  const response = createResponse();
  await handleUpdateProfile(
    {
      user: { _id: patient._id, email: patient.email },
      body: {
        clinicLocation: "Updated clinic address",
        clinicLatitude: 19.076,
        clinicLongitude: 72.8777,
      },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(savedDoctorUpdate.$set.location, {
    type: "Point",
    coordinates: [72.8777, 19.076],
  });
  assert.equal(savedDoctorUpdate.$set.clinicLocation, "Updated clinic address");
  assert.equal(savedDoctorUpdate.$set.locationVerified, false);
});

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}
