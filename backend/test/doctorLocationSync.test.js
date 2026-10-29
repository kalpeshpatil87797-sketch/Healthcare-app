const test = require("node:test");
const assert = require("node:assert/strict");
const Doctor = require("../models/doctor");
const User = require("../models/user");
const Appointment = require("../models/appointment");
const Connection = require("../models/connection");
const { handleListDoctors, handleGetAdminDoctor } = require("../controllers/admin");
const doctorRoutes = require("../routes/doctor");

const doctorId = "0123456789abcdef01234567";
const clinicLocation = {
  type: "Point",
  coordinates: [73.8567, 18.5204],
};

test("Admin doctor list returns the latest saved clinic address, coordinates, and verification state", async (t) => {
  const savedDoctor = {
    _id: doctorId,
    name: "Dr Ada",
    clinicName: "Updated Clinic",
    degree: "MBBS",
    specialist: "Cardiologist",
    clinicLocation: "Updated address, Pune",
    registeredBy: "doctor@example.test",
    approvalStatus: "approved",
    isActive: true,
    isAvailable: true,
    location: clinicLocation,
    locationVerified: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-02-01T00:00:00Z"),
  };
  t.mock.method(Doctor, "find", () => buildQuery([savedDoctor]));
  t.mock.method(Doctor, "countDocuments", async () => 1);
  t.mock.method(User, "find", () => buildQuery([
    { _id: "user-id", email: savedDoctor.registeredBy, name: savedDoctor.name, role: "doctor" },
  ]));

  const response = createResponse();
  await handleListDoctors({ query: {} }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data[0].clinicLocation, savedDoctor.clinicLocation);
  assert.equal(response.body.data[0].latitude, 18.5204);
  assert.equal(response.body.data[0].longitude, 73.8567);
  assert.equal(response.body.data[0].locationVerified, false);
  assert.equal(response.body.data[0].updatedAt, savedDoctor.updatedAt);
});

test("Admin doctor detail returns the latest persisted clinic fields", async (t) => {
  const savedDoctor = {
    _id: doctorId,
    name: "Dr Ada",
    clinicName: "Updated Clinic",
    degree: "MBBS",
    specialist: "Cardiologist",
    clinicLocation: "Updated address, Pune",
    registeredBy: "doctor@example.test",
    approvalStatus: "approved",
    isActive: true,
    isAvailable: true,
    location: clinicLocation,
    locationVerified: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-02-01T00:00:00Z"),
  };
  t.mock.method(Doctor, "findById", () => ({
    select() { return this; },
    async lean() { return savedDoctor; },
  }));
  t.mock.method(User, "findOne", () => ({
    select() { return this; },
    async lean() { return { _id: "user-id", name: savedDoctor.name, email: savedDoctor.registeredBy }; },
  }));
  t.mock.method(Appointment, "countDocuments", async () => 2);
  t.mock.method(Connection, "countDocuments", async () => 3);

  const response = createResponse();
  await handleGetAdminDoctor({ params: { id: doctorId } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.clinicLocation, savedDoctor.clinicLocation);
  assert.equal(response.body.data.latitude, 18.5204);
  assert.equal(response.body.data.longitude, 73.8567);
  assert.equal(response.body.data.locationVerified, false);
  assert.equal(response.body.data.updatedAt, savedDoctor.updatedAt);
});

test("re-fetching Admin doctor detail returns the newest clinic changes", async (t) => {
  let persistedDoctor = {
    _id: doctorId,
    name: "Dr Ada",
    clinicName: "Original Clinic",
    degree: "MBBS",
    specialist: "Cardiologist",
    clinicLocation: "Original address",
    registeredBy: "doctor@example.test",
    approvalStatus: "approved",
    isActive: true,
    isAvailable: true,
    location: clinicLocation,
    locationVerified: false,
  };
  t.mock.method(Doctor, "findById", () => ({
    select() { return this; },
    async lean() { return persistedDoctor; },
  }));
  t.mock.method(User, "findOne", () => ({
    select() { return this; },
    async lean() { return { _id: "user-id", name: persistedDoctor.name, email: persistedDoctor.registeredBy }; },
  }));
  t.mock.method(Appointment, "countDocuments", async () => 0);
  t.mock.method(Connection, "countDocuments", async () => 0);

  const firstResponse = createResponse();
  await handleGetAdminDoctor({ params: { id: doctorId } }, firstResponse);
  assert.equal(firstResponse.body.data.clinicLocation, "Original address");

  persistedDoctor = {
    ...persistedDoctor,
    clinicName: "Updated Clinic",
    clinicLocation: "Updated address",
    location: { type: "Point", coordinates: [72.8777, 19.076] },
  };
  const refreshedResponse = createResponse();
  await handleGetAdminDoctor({ params: { id: doctorId } }, refreshedResponse);

  assert.equal(refreshedResponse.body.data.clinicName, "Updated Clinic");
  assert.equal(refreshedResponse.body.data.clinicLocation, "Updated address");
  assert.equal(refreshedResponse.body.data.latitude, 19.076);
  assert.equal(refreshedResponse.body.data.longitude, 72.8777);
  assert.equal(refreshedResponse.body.data.locationVerified, false);
});

test("doctor API responses disable caching so refreshed searches read current data", () => {
  const cacheMiddleware = doctorRoutes.stack[0].handle;
  const headers = {};
  let continued = false;
  cacheMiddleware(
    {},
    { set(name, value) { headers[name] = value; } },
    () => { continued = true; }
  );
  assert.equal(headers["Cache-Control"], "no-store");
  assert.equal(continued, true);
});

function buildQuery(value) {
  return {
    select() { return this; },
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    async lean() { return value; },
  };
}

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
