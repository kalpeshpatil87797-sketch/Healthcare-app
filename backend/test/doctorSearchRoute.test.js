const test = require("node:test");
const assert = require("node:assert/strict");
const doctorRoutes = require("../routes/doctor");
const Doctor = require("../models/doctor");
const User = require("../models/user");
const { handleSearchDoctors } = require("../controllers/doctor");
const { restrictToLoggedinUserOnly } = require("../middlewares/auth");

test("doctor search endpoint is registered with authentication and the search handler", () => {
  const routeLayer = doctorRoutes.stack.find(
    (layer) => layer.route?.path === "/search"
  );

  assert.ok(routeLayer, "GET /doctor/search route should be registered");
  assert.equal(routeLayer.route.methods.get, true);
  assert.equal(routeLayer.route.stack[0].handle, restrictToLoggedinUserOnly);
  assert.equal(routeLayer.route.stack[1].handle, handleSearchDoctors);
});

test("doctor search filters by name, specialty, and clinic area and returns map coordinates", async (t) => {
  let capturedQuery;
  t.mock.method(User, "find", () => ({
    select() { return this; },
    async lean() { return [{ email: "doctor@example.test" }]; },
  }));
  t.mock.method(Doctor, "find", (query) => {
    capturedQuery = query;
    return {
      select() { return this; },
      sort() { return this; },
      limit() { return this; },
      async lean() {
        return [{
          _id: "doctor-id",
          name: "Dr Ada",
          clinicName: "Example Clinic",
          specialist: "Cardiologist",
          clinicLocation: "Pune",
          isAvailable: true,
          isActive: true,
          approvalStatus: "approved",
          locationVerified: true,
          location: { type: "Point", coordinates: [73.8567, 18.5204] },
        }];
      },
    };
  });

  const response = createResponse();
  await handleSearchDoctors(
    { query: { name: "Ada", specialty: "Cardiologist", location: "Pune" } },
    response
  );

  assert.equal(capturedQuery.name.$regex, "Ada");
  assert.equal(capturedQuery.specialist.$regex, "^Cardiologist$");
  assert.equal(capturedQuery.clinicLocation.$regex, "Pune");
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.doctors[0], {
    _id: "doctor-id",
    name: "Dr Ada",
    clinicName: "Example Clinic",
    degree: undefined,
    specialist: "Cardiologist",
    clinicLocation: "Pune",
    approvalStatus: "approved",
    isActive: true,
    isAvailable: true,
    locationVerified: true,
    latitude: 18.5204,
    longitude: 73.8567,
  });
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
