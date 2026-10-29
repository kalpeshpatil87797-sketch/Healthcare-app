const test = require("node:test");
const assert = require("node:assert/strict");
const Doctor = require("../models/doctor");
const adminRoutes = require("../routes/admin");
const { handleUpdateClinicLocationVerification } = require("../controllers/admin");
const {
  buildClinicLocationVerificationUpdate,
  getPublicClinicLocation,
} = require("../utils/clinicLocationVerification");

const savedClinicLocation = {
  type: "Point",
  coordinates: [-73.9857, 40.7484],
};

test("doctor profiles default clinic-location verification to false", () => {
  assert.equal(Doctor.schema.path("locationVerified").defaultValue, false);
});

test("admins and root owners can explicitly verify saved clinic coordinates", () => {
  for (const role of ["admin", "root_owner"]) {
    assert.deepEqual(
      buildClinicLocationVerificationUpdate(role, true, savedClinicLocation),
      { update: { $set: { locationVerified: true } } }
    );
  }
});

test("unauthorized roles cannot verify or revoke clinic locations", () => {
  for (const role of ["patient", "doctor", "super_admin", undefined]) {
    for (const isVerified of [true, false]) {
      const result = buildClinicLocationVerificationUpdate(
        role,
        isVerified,
        savedClinicLocation
      );
      assert.equal(result.status, 403, `${role} must not update verification`);
      assert.equal(result.update, undefined);
    }
  }
});

test("admins can revoke verification even if coordinates are absent", () => {
  assert.deepEqual(
    buildClinicLocationVerificationUpdate("admin", false, null),
    { update: { $set: { locationVerified: false } } }
  );
});

test("authorized admin verification persists only the location status", async (t) => {
  const doctorId = "0123456789abcdef01234567";
  const updates = [];
  t.mock.method(Doctor, "findById", () => ({
    select() { return this; },
    async lean() {
      return { _id: doctorId, location: savedClinicLocation, locationVerified: false };
    },
  }));
  t.mock.method(Doctor, "findOneAndUpdate", (...args) => {
    updates.push(args);
    return {
      select() { return this; },
      async lean() {
        return {
          _id: doctorId,
          location: savedClinicLocation,
          locationVerified: true,
        };
      },
    };
  });

  const response = createResponse();
  await handleUpdateClinicLocationVerification(
    {
      params: { id: doctorId },
      body: { isVerified: true },
      currentUser: { _id: "admin-id", role: "admin" },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.doctor.locationVerified, true);
  assert.deepEqual(updates[0][1], { $set: { locationVerified: true } });
  assert.deepEqual(updates[0][0]["location.coordinates"], savedClinicLocation.coordinates);
});

test("unauthorized controller requests do not update a clinic location", async (t) => {
  const doctorId = "0123456789abcdef01234567";
  let updateCalled = false;
  t.mock.method(Doctor, "findById", () => ({
    select() { return this; },
    async lean() {
      return { _id: doctorId, location: savedClinicLocation, locationVerified: false };
    },
  }));
  t.mock.method(Doctor, "findOneAndUpdate", () => {
    updateCalled = true;
    throw new Error("Unauthorized update attempted");
  });

  const response = createResponse();
  await handleUpdateClinicLocationVerification(
    {
      params: { id: doctorId },
      body: { isVerified: true },
      currentUser: { _id: "patient-id", role: "patient" },
    },
    response
  );

  assert.equal(response.statusCode, 403);
  assert.equal(updateCalled, false);
});

test("authorized admin revocation persists false without requiring coordinates", async (t) => {
  const doctorId = "0123456789abcdef01234567";
  const updates = [];
  t.mock.method(Doctor, "findById", () => ({
    select() { return this; },
    async lean() {
      return { _id: doctorId, location: null, locationVerified: true };
    },
  }));
  t.mock.method(Doctor, "findOneAndUpdate", (...args) => {
    updates.push(args);
    return {
      select() { return this; },
      async lean() {
        return { _id: doctorId, locationVerified: false };
      },
    };
  });

  const response = createResponse();
  await handleUpdateClinicLocationVerification(
    {
      params: { id: doctorId },
      body: { isVerified: false },
      currentUser: { _id: "owner-id", role: "root_owner" },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.doctor.locationVerified, false);
  assert.deepEqual(updates[0][1], { $set: { locationVerified: false } });
  assert.equal(Object.keys(updates[0][0]).length, 1);
});

test("verification requires valid saved GeoJSON coordinates", () => {
  for (const location of [
    null,
    { type: "Point", coordinates: [] },
    { type: "Point", coordinates: [-181, 40] },
    { type: "Point", coordinates: [-73, 91] },
    { type: "LineString", coordinates: [-73, 40] },
  ]) {
    assert.equal(
      buildClinicLocationVerificationUpdate("admin", true, location).code,
      "CLINIC_COORDINATES_REQUIRED"
    );
  }
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

test("public doctor results expose coordinates only for verified clinics", () => {
  assert.deepEqual(
    getPublicClinicLocation(false, savedClinicLocation),
    { locationVerified: false }
  );
  assert.deepEqual(
    getPublicClinicLocation(true, savedClinicLocation),
    {
      locationVerified: true,
      latitude: 40.7484,
      longitude: -73.9857,
    }
  );
  const frontendMapFields = getPublicClinicLocation(true, savedClinicLocation);
  assert.equal(frontendMapFields.locationVerified, true);
  assert.equal(frontendMapFields.latitude, savedClinicLocation.coordinates[1]);
  assert.equal(frontendMapFields.longitude, savedClinicLocation.coordinates[0]);
  assert.deepEqual(
    getPublicClinicLocation(true, { type: "Point", coordinates: [200, 40] }),
    { locationVerified: true }
  );
});

test("admin route uses an Admin/Root Owner gate and the verification handler", async () => {
  const routeLayer = adminRoutes.stack.find(
    (layer) => layer.route?.path === "/doctors/:id/location-verification"
  );
  assert.ok(routeLayer);
  assert.equal(routeLayer.route.methods.patch, true);
  assert.equal(
    routeLayer.route.stack[routeLayer.route.stack.length - 1].handle,
    handleUpdateClinicLocationVerification
  );
  assert.equal(routeLayer.route.stack.length, 2);

  const roleGate = routeLayer.route.stack[0].handle;
  for (const role of ["admin", "root_owner"]) {
    let continued = false;
    await roleGate(
      {
        user: { _id: "actor-id" },
        currentUser: { _id: "actor-id", role, accountStatus: "active" },
      },
      { status() { throw new Error("authorized actor was rejected"); } },
      () => { continued = true; }
    );
    assert.equal(continued, true, `${role} should be authorized`);
  }

  for (const role of ["patient", "doctor", "super_admin"]) {
    let statusCode = null;
    await roleGate(
      {
        user: { _id: "actor-id" },
        currentUser: { _id: "actor-id", role, accountStatus: "active" },
      },
      {
        status(code) {
          statusCode = code;
          return { json() {} };
        },
      },
      () => { throw new Error(`${role} unexpectedly passed the route gate`); }
    );
    assert.equal(statusCode, 403, `${role} must be forbidden`);
  }
});
